// backend/src/controllers/staff.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { getIO } from '../utils/socket';
import logger from '../config/logger';
import { hospitalIdOf, departmentRoom } from '../utils/tenant';
import { pageParams, pageInfo } from '../utils/pagination';
import { dayRange, hospitalTimezone } from '../utils/time';
import { sendSetPasswordMail } from '../services/staffLink';
import type { Prisma } from '@prisma/client';
import {
  buildShiftWhere, buildStaffUpdate, createStaffRecord, groupShiftTimeline, isForeignKeyViolation, isUniqueViolation,
  linkStaffLogin, toStaffDto, type CreateStaffInput,
} from '../services/staffManagement';

// ─── Helpers ───────────────────────────────────────────────────────────

const handleError = (res: Response, error: unknown, message: string) => {
  logger.error({ err: error }, message);
  res.status(500).json({ success: false, message });
};

export const getStaff = async (req: Request, res: Response) => {
  try {
    const page = pageParams(req.query);
    const where = { hospitalId: hospitalIdOf(req) };
    const [staff, totalCount] = await Promise.all([
      prisma.staff.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: page.skip, take: page.take }),
      prisma.staff.count({ where }),
    ]);

    res.status(200).json({ success: true, count: staff.length, data: staff.map(toStaffDto), pagination: pageInfo(page, totalCount) });
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
      return res.status(404).json({ success: false, code: 'STAFF_NOT_FOUND', message: 'Staff not found' });
    }

    res.status(200).json({ success: true, data: toStaffDto(staff) });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch staff');
  }
};

// POST /api/staff - Create staff. With `loginRole` it also creates the login (emailed set-password link);
// an existing unlinked login of the same hospital with the same email is linked instead.
export const createStaff = async (req: Request, res: Response) => {
  try {
    const outcome = await createStaffRecord(req.body as CreateStaffInput, hospitalIdOf(req));
    if (outcome.kind === 'email-other-hospital') {
      return res.status(409).json({ success: false, message: 'This email is already used by another account' });
    }
    if (outcome.kind === 'login-already-linked') {
      return res.status(409).json({ success: false, message: 'A login with this email is already linked to another staff member' });
    }
    const { staff, newUserId } = outcome;

    if (newUserId) sendSetPasswordMail(newUserId, (req.body as CreateStaffInput).email);

    res.status(201).json({ success: true, data: toStaffDto(staff) });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ success: false, message: 'A staff member with this email already exists' });
    }
    handleError(res, error, 'Failed to create staff');
  }
};

// PUT /api/staff/:id - Update staff
export const updateStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const updateData = req.body;

    const hospitalId = hospitalIdOf(req);
    const existing = await prisma.staff.findFirst({ where: { id, hospitalId }, select: { id: true, userId: true } });
    if (!existing) return res.status(404).json({ success: false, code: 'STAFF_NOT_FOUND', message: 'Staff not found' });

    const data = await buildStaffUpdate(updateData, existing, hospitalId);

    const staff = await prisma.staff.update({
      where: { id },
      data,
    });

    res.status(200).json({ success: true, data: toStaffDto(staff) });
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ success: false, message: 'A staff member with this email already exists' });
    }
    handleError(res, error, 'Failed to update staff');
  }
};

// PUT /api/staff/:id/login - Link a login (User of the same hospital) to this staff member, or unlink with null.
// This is how a mistyped email gets fixed: notifications follow the link, not the email.
export const setStaffLogin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { userId } = req.body as { userId: string | null };
    const outcome = await linkStaffLogin(id, userId, hospitalIdOf(req));
    switch (outcome.kind) {
      case 'staff-not-found':
        return res.status(404).json({ success: false, code: 'STAFF_NOT_FOUND', message: 'Staff not found' });
      case 'user-not-found':
        return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', message: 'User not found' });
      case 'already-linked':
        return res.status(409).json({ success: false, message: 'This login is already linked to another staff member' });
      case 'ok':
        return res.status(200).json({ success: true, data: toStaffDto(outcome.staff) });
    }
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({ success: false, message: 'This login is already linked to another staff member' });
    }
    handleError(res, error, 'Failed to link staff login');
  }
};

// DELETE /api/staff/:id - Delete staff
export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const existing = await prisma.staff.findFirst({ where: { id, hospitalId: hospitalIdOf(req) }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, code: 'STAFF_NOT_FOUND', message: 'Staff not found' });

    await prisma.staff.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'Staff deleted' });
  } catch (error: unknown) {
    // Appointments keep their doctor (ON DELETE RESTRICT): history is never orphaned.
    if (isForeignKeyViolation(error)) {
      return res.status(409).json({ success: false, message: 'Staff member has appointments: reassign or cancel them first' });
    }
    handleError(res, error, 'Failed to delete staff');
  }
};

// ─── Shift Management ──────────────────────────────────────────────────

// GET /api/staff/shifts - Get all shifts (with filters)
export const getShifts = async (req: Request, res: Response) => {
  try {
    const where = buildShiftWhere(hospitalIdOf(req), req.query);

    const page = pageParams(req.query);
    const [shifts, totalCount] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: { staff: { select: { name: true, role: true, avatar: true } } },
        orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
        skip: page.skip,
        take: page.take,
      }),
      prisma.shift.count({ where }),
    ]);

    res.status(200).json({ success: true, count: shifts.length, data: shifts, pagination: pageInfo(page, totalCount) });
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
    if (!owner) return res.status(404).json({ success: false, code: 'STAFF_NOT_FOUND', message: 'Staff not found' });

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
    getIO().to(departmentRoom(hospitalId, department)).emit('shift-update', shift);

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
    if (!existing) return res.status(404).json({ success: false, code: 'SHIFT_NOT_FOUND', message: 'Shift not found' });

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

    getIO().to(departmentRoom(hospitalId, shift.department)).emit('shift-update', shift);

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
    if (!existing) return res.status(404).json({ success: false, code: 'SHIFT_NOT_FOUND', message: 'Shift not found' });

    const shift = await prisma.shift.delete({
      where: { id },
      include: { staff: { select: { name: true, role: true } } },
    });

    getIO().to(departmentRoom(hospitalId, shift.department)).emit('shift-delete', { id });

    res.status(200).json({ success: true, message: 'Shift deleted' });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to delete shift');
  }
};

// GET /api/staff/shifts/timeline - Get 24h timeline by department
export const getShiftTimeline = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const { start, end } = dayRange(await hospitalTimezone(hospitalIdOf(req)), date as string | undefined);

    const shifts = await prisma.shift.findMany({
      where: {
        staff: { hospitalId: hospitalIdOf(req) },
        startTime: { gte: start },
        endTime: { lte: end },
      },
      include: {
        staff: { select: { name: true, role: true, department: true, avatar: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const timeline = groupShiftTimeline(shifts);

    res.status(200).json({ success: true, data: timeline });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch shift timeline');
  }
};