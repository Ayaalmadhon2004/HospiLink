// backend/src/controllers/staff.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { io } from '../server';
import logger from '../config/logger';
import { hospitalIdOf, departmentRoom } from '../utils/tenant';
import { linkStaffToUserByEmail, randomPasswordHash, sendSetPasswordMail } from '../services/staffLink';
import type { Prisma, Role } from '@prisma/client';

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

// The login id stays server-side; clients only learn whether the staff member can sign in / be notified.
const toStaffDto = <T extends { userId: string | null }>(staff: T) => {
  const { userId, ...rest } = staff;
  return { ...rest, hasLogin: Boolean(userId) };
};

const isUniqueViolation = (error: unknown): boolean => (error as { code?: unknown })?.code === 'P2002';

export const getStaff = async (req: Request, res: Response) => {
  try {
    const staff = await prisma.staff.findMany({ where: { hospitalId: hospitalIdOf(req) } });

    res.status(200).json({ success: true, count: staff.length, data: staff.map(toStaffDto) });
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

    res.status(200).json({ success: true, data: toStaffDto(staff) });
  } catch (error: unknown) {
    handleError(res, error, 'Failed to fetch staff');
  }
};

// POST /api/staff - Create staff. With `loginRole` it also creates the login (emailed set-password link);
// an existing unlinked login of the same hospital with the same email is linked instead.
export const createStaff = async (req: Request, res: Response) => {
  try {
    const { name, email, role, department, phone, avatar, loginRole } = req.body as {
      name: string; email: string; role: string; department: string; phone?: string; avatar?: string; loginRole?: Role;
    };
    const hospitalId = hospitalIdOf(req);

    // Emails are unique across hospitals for logins: never link (or reveal) a login of another hospital.
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, hospitalId: true, staff: { select: { id: true } } },
    });
    if (existingUser && existingUser.hospitalId !== hospitalId && loginRole) {
      return res.status(409).json({ success: false, message: 'This email is already used by another account' });
    }
    const sameHospitalUser = existingUser && existingUser.hospitalId === hospitalId ? existingUser : null;
    if (sameHospitalUser?.staff && loginRole) {
      return res.status(409).json({ success: false, message: 'A login with this email is already linked to another staff member' });
    }
    const linkUserId = sameHospitalUser && !sameHospitalUser.staff ? sameHospitalUser.id : null;
    const createLogin = Boolean(loginRole) && !existingUser;

    const { staff, newUserId } = await prisma.$transaction(async (tx) => {
      let userId = linkUserId;
      if (createLogin && loginRole) {
        const user = await tx.user.create({
          data: {
            email,
            password: await randomPasswordHash(),
            name,
            role: loginRole,
            department,
            shift: 'DAY',
            accountStatus: 'ACTIVE',
            emailVerifiedAt: new Date(),
            hospitalId,
          },
          select: { id: true },
        });
        userId = user.id;
      }
      const created = await tx.staff.create({
        data: { name, email, role, department, phone, avatar, hospitalId, userId },
      });
      return { staff: created, newUserId: createLogin ? userId : null };
    });

    if (newUserId) sendSetPasswordMail(newUserId, email);

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
    if (!existing) return res.status(404).json({ success: false, message: 'Staff not found' });

    // Correcting a mistyped email of a staff member without a login: attach the matching login of this
    // hospital if there is one (the link itself never depends on the email afterwards).
    const data: Prisma.StaffUncheckedUpdateInput = { ...updateData };
    if (typeof updateData.email === 'string' && !existing.userId) {
      const candidate = await prisma.user.findFirst({
        where: { hospitalId, email: { equals: updateData.email, mode: 'insensitive' }, staff: null },
        select: { id: true },
      });
      if (candidate) data.userId = candidate.id;
    }

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
    const hospitalId = hospitalIdOf(req);

    const existing = await prisma.staff.findFirst({ where: { id, hospitalId }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Staff not found' });

    if (userId !== null) {
      const user = await prisma.user.findFirst({
        where: { id: userId, hospitalId },
        select: { id: true, staff: { select: { id: true } } },
      });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      if (user.staff && user.staff.id !== id) {
        return res.status(409).json({ success: false, message: 'This login is already linked to another staff member' });
      }
    }

    const staff = await prisma.staff.update({ where: { id }, data: { userId } });
    res.status(200).json({ success: true, data: toStaffDto(staff) });
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