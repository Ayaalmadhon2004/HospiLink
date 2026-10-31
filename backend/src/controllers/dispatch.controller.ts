// src/controllers/dispatch.controller.ts
import { Request, Response } from 'express';
import { getIO } from '../utils/socket';
import prisma from '../config/db';
import type { CallStatus, UnitStatus, UnitType } from '@prisma/client';
import logger from '../config/logger';
import { hospitalIdOf, dispatchRoom, departmentRoom, unitRoom } from '../utils/tenant';
import { notify } from '../services/notification.service';
import {
  assignUnitTx, closeCallTx, crewBelongsToHospital, isUniqueViolation, LifecycleError, unitInclude, updateUnitStatusTx,
} from '../services/dispatchLifecycle';

// Dispatch events go to dispatchers and admins, never the actor.
const dispatchRecipients = (hospitalId: string, actorId?: string) => ({
  hospitalId,
  roles: ['DISPATCHER', 'ADMIN'] as Array<'DISPATCHER' | 'ADMIN'>,
  excludeUserId: actorId,
});

// ❌ شيلي هاد — errorHandler هو middleware مش function
// import { errorHandler } from '../middlewares/error.middleware';

// ✅ استبدليه بـ helper function بسيط
const handleError = (res: Response, error: unknown, message: string, statusCode: number = 500) => {
  logger.error({ err: error }, `[Dispatch Error] ${message}:`);
  res.status(statusCode).json({
    success: false,
    message,
  });
};

// GET /api/dispatch/units — كل الوحدات
export const getAllUnits = async (req: Request, res: Response) => {
  try {
    const units = await prisma.dispatchUnit.findMany({
      where: { hospitalId: hospitalIdOf(req) },
      include: unitInclude,
      orderBy: { unitCode: 'asc' }
    });
    res.status(200).json({ success: true, data: units });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch units');
  }
};

// GET /api/dispatch/units/active — الوحدات النشطة فقط
export const getActiveUnits = async (req: Request, res: Response) => {
  try {
    const units = await prisma.dispatchUnit.findMany({
      where: {
        hospitalId: hospitalIdOf(req),
        status: { not: 'OFF_DUTY' }
      },
      include: unitInclude,
      orderBy: { unitCode: 'asc' }
    });
    res.status(200).json({ success: true, data: units });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch active units');
  }
};

// GET /api/dispatch/calls?status=PENDING — النداءات (الافتراضي: بانتظار التعيين)
export const getCalls = async (req: Request, res: Response) => {
  try {
    const { status } = req.query as { status?: CallStatus };
    const calls = await prisma.dispatchCall.findMany({
      where: { status: status ?? 'PENDING', hospitalId: hospitalIdOf(req) },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    res.status(200).json({ success: true, data: calls });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch calls');
  }
};

// PUT /api/dispatch/units/:id/status — تحديث حالة الوحدة
// Rules: a unit on an active call cannot become AVAILABLE/OFF_DUTY (complete or cancel the call first), and
// EN_ROUTE / ON_SCENE are mirrored on its call. The call link itself is never set from here.
export const updateUnitStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { status, lat, lng, eta } = req.body as { status?: UnitStatus; lat?: number; lng?: number; eta?: number | null };
    const hospitalId = hospitalIdOf(req);

    const unit = await updateUnitStatusTx(id, hospitalId, { status, lat, lng, eta });

    // 🔥 بث التحديث لكل المشتركين
    getIO().to(dispatchRoom(hospitalId)).emit('unit-status-update', {
      unitId: id,
      status,
      lat,
      lng,
      eta,
      timestamp: new Date()
    });

    // لو فيه قسم محدد، بث للقسم كمان
    getIO().to(departmentRoom(hospitalId, unit.department)).emit('unit-status-update', {
      unitId: id,
      status,
      unitCode: unit.unitCode
    });

    res.status(200).json({ success: true, data: unit });
  } catch (error: unknown) {
    if (error instanceof LifecycleError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    handleError(res, error, 'Failed to update unit status');
  }
};

// POST /api/dispatch/units — add a unit to the fleet of the caller's hospital
export const createUnit = async (req: Request, res: Response) => {
  try {
    const { unitCode, unitType, department, crewIds } = req.body as {
      unitCode: string; unitType: UnitType; department?: string; crewIds?: string[];
    };
    const hospitalId = hospitalIdOf(req);

    if (crewIds?.length && !(await crewBelongsToHospital(crewIds, hospitalId))) {
      return res.status(404).json({ success: false, code: 'STAFF_NOT_FOUND', message: 'Crew member not found' });
    }

    const unit = await prisma.dispatchUnit.create({
      data: { unitCode, unitType, department, hospitalId, crew: { connect: crewIds?.map((id) => ({ id })) ?? [] } },
      include: unitInclude,
    });

    getIO().to(dispatchRoom(hospitalId)).emit('unit-created', { unitId: unit.id, unitCode: unit.unitCode, timestamp: new Date() });
    res.status(201).json({ success: true, data: unit });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ success: false, message: 'A unit with this code already exists' });
    }
    handleError(res, error, 'Failed to create unit');
  }
};

// PUT /api/dispatch/units/:id — edit the unit's identity (code, type, department, crewIds); status has its own route
export const updateUnit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const hospitalId = hospitalIdOf(req);

    const existing = await prisma.dispatchUnit.findFirst({ where: { id, hospitalId }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, code: 'UNIT_NOT_FOUND', message: 'Unit not found' });

    const { unitCode, unitType, department, crewIds } = req.body as {
      unitCode?: string; unitType?: UnitType; department?: string; crewIds?: string[];
    };
    if (crewIds?.length && !(await crewBelongsToHospital(crewIds, hospitalId))) {
      return res.status(404).json({ success: false, code: 'STAFF_NOT_FOUND', message: 'Crew member not found' });
    }
    // `set` replaces the whole crew: members not listed are released (Staff.dispatchUnitId -> null).
    const unit = await prisma.dispatchUnit.update({
      where: { id },
      data: { unitCode, unitType, department, ...(crewIds ? { crew: { set: crewIds.map((cid) => ({ id: cid })) } } : {}) },
      include: unitInclude,
    });

    getIO().to(dispatchRoom(hospitalId)).emit('unit-updated', { unitId: id, timestamp: new Date() });
    res.status(200).json({ success: true, data: unit });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ success: false, message: 'A unit with this code already exists' });
    }
    handleError(res, error, 'Failed to update unit');
  }
};

// DELETE /api/dispatch/units/:id — only a unit that is not on a call
export const deleteUnit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const hospitalId = hospitalIdOf(req);

    const { count } = await prisma.dispatchUnit.deleteMany({ where: { id, hospitalId, currentCallId: null } });
    if (count === 0) {
      const exists = await prisma.dispatchUnit.findFirst({ where: { id, hospitalId }, select: { id: true } });
      return res.status(exists ? 409 : 404).json({
        success: false,
        message: exists ? 'Unit is on an active call: complete or cancel the call first' : 'Unit not found',
      });
    }

    getIO().to(dispatchRoom(hospitalId)).emit('unit-deleted', { unitId: id, timestamp: new Date() });
    res.status(200).json({ success: true, message: 'Unit deleted' });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to delete unit');
  }
};

// POST /api/dispatch/calls — إنشاء نداء جديد
export const createCall = async (req: Request, res: Response) => {
  try {
    const { type, location, priority, notes } = req.body;
    const hospitalId = hospitalIdOf(req);

    const call = await prisma.dispatchCall.create({
      data: {
        hospitalId,
        type,
        location,
        priority,
        notes,
        status: 'PENDING'
      }
    });

    // 🔥 بث النداء الجديد لكل الديسباتش
    getIO().to(dispatchRoom(hospitalId)).emit('new-call', {
      callId: call.id,
      type,
      location,
      priority,
      timestamp: new Date()
    });

    // إذا CRITICAL، بث تنبيه خاص
    if (priority === 'CRITICAL') {
      getIO().to(dispatchRoom(hospitalId)).emit('critical-alert', {
        message: `CRITICAL: ${type} at ${location}`,
        callId: call.id
      });
    }

    await notify({
      type: 'DISPATCH',
      title: priority === 'CRITICAL' ? 'Critical dispatch call' : 'New dispatch call',
      message: `${type} at ${location} (${call.priority})`,
      link: '/dispatch',
      recipients: dispatchRecipients(hospitalId, req.user?.id),
    });

    res.status(201).json({ success: true, data: call });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to create call');
  }
};

// POST /api/dispatch/calls/:id/assign — تعيين وحدة للنداء
export const assignUnitToCall = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { unitId } = req.body;
    const hospitalId = hospitalIdOf(req);

    const { updatedCall, updatedUnit } = await assignUnitTx(id, unitId, hospitalId);

    // 🔥 بث التعيين
    getIO().to(dispatchRoom(hospitalId)).emit('call-assigned', {
      callId: id,
      unitId,
      status: 'EN_ROUTE'
    });

    getIO().to(unitRoom(hospitalId, unitId)).emit('unit-assigned', {
      callId: id,
      callType: updatedCall.type,
      location: updatedCall.location
    });

    await notify({
      type: 'DISPATCH',
      title: 'Unit assigned to call',
      message: `${updatedUnit.unitCode} assigned to ${updatedCall.type} at ${updatedCall.location}`,
      link: '/dispatch',
      recipients: dispatchRecipients(hospitalId, req.user?.id),
    });

    res.status(200).json({ success: true, data: { call: updatedCall, unit: updatedUnit } });
  } catch (error: unknown) {
    if (error instanceof LifecycleError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    handleError(res, error, 'Failed to assign unit');
  }
};
// Closes a call (COMPLETED or CANCELLED) and releases its unit in the same transaction, so the unit never stays
// EN_ROUTE on a finished call. An OFF_DUTY unit keeps that status; otherwise it becomes AVAILABLE with no ETA.
const closeCall = (target: 'COMPLETED' | 'CANCELLED') => async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const hospitalId = hospitalIdOf(req);

    const { call, unit } = await closeCallTx(id, hospitalId, target);

    const event = target === 'COMPLETED' ? 'call-completed' : 'call-cancelled';
    getIO().to(dispatchRoom(hospitalId)).emit(event, { callId: id, unitId: unit?.id ?? null, timestamp: new Date() });
    if (unit) {
      getIO().to(dispatchRoom(hospitalId)).emit('unit-status-update', { unitId: unit.id, status: unit.status, eta: null, timestamp: new Date() });
      getIO().to(unitRoom(hospitalId, unit.id)).emit('unit-released', { callId: id, status: unit.status });
    }

    res.status(200).json({ success: true, data: { call, unit } });
  } catch (error: unknown) {
    if (error instanceof LifecycleError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    handleError(res, error, target === 'COMPLETED' ? 'Failed to complete call' : 'Failed to cancel call');
  }
};

// POST /api/dispatch/calls/:id/complete
export const completeCall = closeCall('COMPLETED');

// POST /api/dispatch/calls/:id/cancel
export const cancelCall = closeCall('CANCELLED');
