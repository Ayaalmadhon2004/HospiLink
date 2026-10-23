// backend/src/controllers/staff.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { io } from '../server';
import logger from '../config/logger';
import { hospitalIdOf, departmentRoom } from '../utils/tenant';
import type { Prisma } from '@prisma/client';

type TimelineEntry = {
  id: string;
  staffName: string;
  role: string;
  avatar: string | null;
  type: string;
  startTime: Date;
  endTime: Date;
  notes: string | null;
};

// ─── Helpers ───────────────────────────────────────────────────────────

const handleError = (res: Response, error: unknown, message: string) => {
  logger.error({ err: error }, message);
  res.status(500).json({ success: false, message });
};

export const getStaff = async (req: Request, res: Response) => {
  try {
    const staff = await prisma.staff.findMany({ where: { hospitalId: hospitalIdOf(req) } });

    res.status(200).json({ success: true, count: staff.length, data: staff });
  } catch (error: unknown) {
    logger.error({ err: error }, 'ERROR:');
    handleError(res, error, 'Failed to fetch staff');
  }
};

// ─── Staff CRUD ────────────────────────────────────────────────────────


// GET /api/staff/:id - Get single staff
export const getStaffById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const staff = await prisma.staff.findFirst({
      where: { id, hospitalId: hospitalIdOf(req) },
      include: {
        shifts: { orderBy: { startTime: 'desc' }, take: 10 },
      },
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    res.status(200).json({ success: true, data: staff });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch staff');
  }
};

// POST /api/staff - Create staff
export const createStaff = async (req: Request, res: Response) => {
  try {
    const { name, email, role, department, phone, avatar } = req.body;

    const staff = await prisma.staff.create({
      data: { name, email, role, department, phone, avatar, hospitalId: hospitalIdOf(req) },
    });

    res.status(201).json({ success: true, data: staff });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to create staff');
  }
};

// PUT /api/staff/:id - Update staff
export const updateStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const updateData = req.body;

    const existing = await prisma.staff.findFirst({ where: { id, hospitalId: hospitalIdOf(req) }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Staff not found' });

    const staff = await prisma.staff.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({ success: true, data: staff });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to update staff');
  }
};

// DELETE /api/staff/:id - Delete staff
export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const existing = await prisma.staff.findFirst({ where: { id, hospitalId: hospitalIdOf(req) }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Staff not found' });

    await prisma.staff.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'Staff deleted' });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to delete staff');
  }
};

// ─── Shift Management ──────────────────────────────────────────────────

// GET /api/staff/shifts - Get all shifts (with filters)
export const getShifts = async (req: Request, res: Response) => {
  try {
    const { department, staffId, date } = req.query;

    const where: Prisma.ShiftWhereInput = { staff: { hospitalId: hospitalIdOf(req) } };
    if (department) where.department = department as string;
    if (staffId) where.staffId = staffId as string;
    if (date) {
      const d = new Date(date as string);
      where.startTime = { gte: d };
      where.endTime = { lte: new Date(d.getTime() + 24 * 60 * 60 * 1000) };
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: { staff: { select: { name: true, role: true, avatar: true } } },
      orderBy: { startTime: 'asc' },
    });

    res.status(200).json({ success: true, count: shifts.length, data: shifts });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch shifts');
  }
};

// POST /api/staff/shifts - Create shift
export const createShift = async (req: Request, res: Response) => {
  try {
    const { staffId, type, startTime, endTime, department, notes } = req.body;
    const hospitalId = hospitalIdOf(req);

    const owner = await prisma.staff.findFirst({ where: { id: staffId, hospitalId }, select: { id: true } });
    if (!owner) return res.status(404).json({ success: false, message: 'Staff not found' });

    const shift = await prisma.shift.create({
      data: {
        staffId,
        type,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        department,
        notes,
      },
      include: { staff: { select: { name: true, role: true, avatar: true } } },
    });

    // Emit real-time update
    io.to(departmentRoom(hospitalId, department)).emit('shift-update', shift);

    res.status(201).json({ success: true, data: shift });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to create shift');
  }
};

// PUT /api/staff/shifts/:id - Update shift
export const updateShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { type, startTime, endTime, department, notes } = req.body;
    const hospitalId = hospitalIdOf(req);

    const existing = await prisma.shift.findFirst({ where: { id, staff: { hospitalId } }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Shift not found' });

    const shift = await prisma.shift.update({
      where: { id },
      data: {
        type,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        department,
        notes,
      },
      include: { staff: { select: { name: true, role: true, avatar: true } } },
    });

    io.to(departmentRoom(hospitalId, shift.department)).emit('shift-update', shift);

    res.status(200).json({ success: true, data: shift });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to update shift');
  }
};

// DELETE /api/staff/shifts/:id - Delete shift
export const deleteShift = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const hospitalId = hospitalIdOf(req);

    const existing = await prisma.shift.findFirst({ where: { id, staff: { hospitalId } }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Shift not found' });

    const shift = await prisma.shift.delete({
      where: { id },
      include: { staff: { select: { name: true, role: true } } },
    });

    io.to(departmentRoom(hospitalId, shift.department)).emit('shift-delete', { id });

    res.status(200).json({ success: true, message: 'Shift deleted' });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to delete shift');
  }
};

// GET /api/staff/shifts/timeline - Get 24h timeline by department
export const getShiftTimeline = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const shifts = await prisma.shift.findMany({
      where: {
        staff: { hospitalId: hospitalIdOf(req) },
        startTime: { gte: startOfDay },
        endTime: { lte: endOfDay },
      },
      include: {
        staff: { select: { name: true, role: true, department: true, avatar: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // Group by department
    const timeline = shifts.reduce<Record<string, TimelineEntry[]>>((acc, shift) => {
      const dept = shift.department;
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push({
        id: shift.id,
        staffName: shift.staff.name,
        role: shift.staff.role,
        avatar: shift.staff.avatar,
        type: shift.type,
        startTime: shift.startTime,
        endTime: shift.endTime,
        notes: shift.notes,
      });
      return acc;
    }, {});

    res.status(200).json({ success: true, data: timeline });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch shift timeline');
  }
};