// src/controllers/dispatch.controller.ts
import { Request, Response } from 'express';
import { io } from '../server';
import prisma from '../config/db';

// ❌ شيلي هاد — errorHandler هو middleware مش function
// import { errorHandler } from '../middlewares/error.middleware';

// ✅ استبدليه بـ helper function بسيط
const handleError = (res: Response, error: any, message: string, statusCode: number = 500) => {
  console.error(`[Dispatch Error] ${message}:`, error);
  res.status(statusCode).json({
    success: false,
    message,
    error: error?.message || 'Unknown error'
  });
};

// GET /api/dispatch/units — كل الوحدات
export const getAllUnits = async (req: Request, res: Response) => {
  try {
    const units = await prisma.dispatchUnit.findMany({
      include: { currentCall: true },
      orderBy: { unitCode: 'asc' }
    });
    res.status(200).json({ success: true, data: units });
  } catch (error: any) {
    handleError(res, error, 'Failed to fetch units');
  }
};

// GET /api/dispatch/units/active — الوحدات النشطة فقط
export const getActiveUnits = async (req: Request, res: Response) => {
  try {
    const units = await prisma.dispatchUnit.findMany({
      where: {
        status: { not: 'OFF_DUTY' }
      },
      include: { currentCall: true }
    });
    res.status(200).json({ success: true, data: units });
  } catch (error: any) {
    handleError(res, error, 'Failed to fetch active units');
  }
};

// POST /api/dispatch/units/:id/status — تحديث حالة الوحدة
export const updateUnitStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, location, eta, callId } = req.body;

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
    io.to('dispatch-room').emit('unit-status-update', {
      unitId: id,
      status,
      location,
      eta,
      timestamp: new Date()
    });

    // لو فيه قسم محدد، بث للقسم كمان
    io.to(`department-${unit.department}`).emit('unit-status-update', {
      unitId: id,
      status,
      unitCode: unit.unitCode
    });

    res.status(200).json({ success: true, data: unit });
  } catch (error: any) {
    handleError(res, error, 'Failed to update unit status');
  }
};

// POST /api/dispatch/calls — إنشاء نداء جديد
export const createCall = async (req: Request, res: Response) => {
  try {
    const { type, location, priority, notes } = req.body;

    const call = await prisma.dispatchCall.create({
      data: {
        type,
        location,
        priority,
        notes,
        status: 'PENDING'
      }
    });

    // 🔥 بث النداء الجديد لكل الديسباتش
    io.to('dispatch-room').emit('new-call', {
      callId: call.id,
      type,
      location,
      priority,
      timestamp: new Date()
    });

    // إذا CRITICAL، بث تنبيه خاص
    if (priority === 'CRITICAL') {
      io.to('dispatch-room').emit('critical-alert', {
        message: `CRITICAL: ${type} at ${location}`,
        callId: call.id
      });
    }

    res.status(201).json({ success: true, data: call });
  } catch (error: any) {
    handleError(res, error, 'Failed to create call');
  }
};

// POST /api/dispatch/calls/:id/assign — تعيين وحدة للنداء
export const assignUnitToCall = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { unitId } = req.body;

    const [updatedCall, updatedUnit] = await prisma.$transaction([
      prisma.dispatchCall.update({
        where: { id },
        data: { assignedUnitId: unitId, status: 'ASSIGNED' }
      }),
      prisma.dispatchUnit.update({
        where: { id: unitId },
        data: { status: 'EN_ROUTE', currentCallId: id }
      })
    ]);

    // 🔥 بث التعيين
    io.to('dispatch-room').emit('call-assigned', {
      callId: id,
      unitId,
      status: 'EN_ROUTE'
    });

    io.to(`unit-${unitId}`).emit('unit-assigned', {
      callId: id,
      callType: updatedCall.type,
      location: updatedCall.location
    });

    res.status(200).json({ success: true, data: { call: updatedCall, unit: updatedUnit } });
  } catch (error: any) {
    handleError(res, error, 'Failed to assign unit');
  }
};