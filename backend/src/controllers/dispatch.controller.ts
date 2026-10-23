// src/controllers/dispatch.controller.ts
import { Request, Response } from 'express';
import { io } from '../server';
import prisma from '../config/db';
import type { CallStatus } from '@prisma/client';
import logger from '../config/logger';
import { hospitalIdOf, dispatchRoom, departmentRoom, unitRoom } from '../utils/tenant';
import { notify } from '../services/notification.service';

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
      include: { currentCall: true },
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
      include: { currentCall: true }
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

// POST /api/dispatch/units/:id/status — تحديث حالة الوحدة
export const updateUnitStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { status, location, eta, callId } = req.body;
    const hospitalId = hospitalIdOf(req);

    const existing = await prisma.dispatchUnit.findFirst({ where: { id, hospitalId }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Unit not found' });
    if (callId && !(await prisma.dispatchCall.findFirst({ where: { id: callId, hospitalId }, select: { id: true } }))) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    const unit = await prisma.dispatchUnit.update({
      where: { id },
      data: {
        status,
        location: location ? JSON.stringify(location) : undefined,
        eta,
        currentCallId: callId,
        lastUpdated: new Date()
      },
      include: { currentCall: true }
    });

    // 🔥 بث التحديث لكل المشتركين
    io.to(dispatchRoom(hospitalId)).emit('unit-status-update', {
      unitId: id,
      status,
      location,
      eta,
      timestamp: new Date()
    });

    // لو فيه قسم محدد، بث للقسم كمان
    io.to(departmentRoom(hospitalId, unit.department)).emit('unit-status-update', {
      unitId: id,
      status,
      unitCode: unit.unitCode
    });

    res.status(200).json({ success: true, data: unit });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to update unit status');
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
    io.to(dispatchRoom(hospitalId)).emit('new-call', {
      callId: call.id,
      type,
      location,
      priority,
      timestamp: new Date()
    });

    // إذا CRITICAL، بث تنبيه خاص
    if (priority === 'CRITICAL') {
      io.to(dispatchRoom(hospitalId)).emit('critical-alert', {
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

class AssignError extends Error {
  constructor(readonly statusCode: 404 | 409, message: string) {
    super(message);
  }
}

// POST /api/dispatch/calls/:id/assign — تعيين وحدة للنداء
export const assignUnitToCall = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { unitId } = req.body;
    const hospitalId = hospitalIdOf(req);

    // Conditional updates inside one transaction: only a PENDING call and a free AVAILABLE unit
    // can be claimed, so concurrent dispatchers cannot double-assign (the loser gets 409).
    const { updatedCall, updatedUnit } = await prisma.$transaction(async (tx) => {
      const claimedCall = await tx.dispatchCall.updateMany({
        where: { id, hospitalId, status: 'PENDING', assignedUnitId: null },
        data: { assignedUnitId: unitId, status: 'ASSIGNED' },
      });
      if (claimedCall.count === 0) {
        const exists = await tx.dispatchCall.findFirst({ where: { id, hospitalId }, select: { id: true } });
        throw new AssignError(exists ? 409 : 404, exists ? 'Call is no longer pending' : 'Call not found');
      }

      const claimedUnit = await tx.dispatchUnit.updateMany({
        where: { id: unitId, hospitalId, status: 'AVAILABLE', currentCallId: null },
        data: { status: 'EN_ROUTE', currentCallId: id },
      });
      if (claimedUnit.count === 0) {
        const exists = await tx.dispatchUnit.findFirst({ where: { id: unitId, hospitalId }, select: { id: true } });
        throw new AssignError(exists ? 409 : 404, exists ? 'Unit is not available' : 'Unit not found');
      }

      return {
        updatedCall: await tx.dispatchCall.findUniqueOrThrow({ where: { id } }),
        updatedUnit: await tx.dispatchUnit.findUniqueOrThrow({ where: { id: unitId } }),
      };
    });

    // 🔥 بث التعيين
    io.to(dispatchRoom(hospitalId)).emit('call-assigned', {
      callId: id,
      unitId,
      status: 'EN_ROUTE'
    });

    io.to(unitRoom(hospitalId, unitId)).emit('unit-assigned', {
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
    if (error instanceof AssignError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    handleError(res, error, 'Failed to assign unit');
  }
};