// backend/src/services/staffManagement.ts
// Staff <-> login rules and shift read models (extracted from staff.controller).
import prisma from '../config/db';
import { randomPasswordHash } from './staffLink';
import type { Prisma, Role } from '@prisma/client';

// The login id stays server-side; clients only learn whether the staff member can sign in / be notified.
export const toStaffDto = <T extends { userId: string | null }>(staff: T) => {
  const { userId, ...rest } = staff;
  return { ...rest, hasLogin: Boolean(userId) };
};

export const isUniqueViolation = (error: unknown): boolean => (error as { code?: unknown })?.code === 'P2002';
export const isForeignKeyViolation = (error: unknown): boolean => (error as { code?: unknown })?.code === 'P2003';

export interface CreateStaffInput {
  name: string;
  email: string;
  role: string;
  department: string;
  phone?: string;
  avatar?: string;
  loginRole?: Role;
}

export type CreateStaffOutcome =
  | { kind: 'email-other-hospital' }
  | { kind: 'login-already-linked' }
  | { kind: 'created'; staff: Prisma.StaffGetPayload<object>; newUserId: string | null };

// With `loginRole` it also creates the login (caller emails the set-password link for `newUserId`);
// an existing unlinked login of the same hospital with the same email is linked instead.
export const createStaffRecord = async (input: CreateStaffInput, hospitalId: string): Promise<CreateStaffOutcome> => {
  const { name, email, role, department, phone, avatar, loginRole } = input;

  // Emails are unique across hospitals for logins: never link (or reveal) a login of another hospital.
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, hospitalId: true, staff: { select: { id: true } } },
  });
  if (existingUser && existingUser.hospitalId !== hospitalId && loginRole) return { kind: 'email-other-hospital' };
  const sameHospitalUser = existingUser && existingUser.hospitalId === hospitalId ? existingUser : null;
  if (sameHospitalUser?.staff && loginRole) return { kind: 'login-already-linked' };
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

  return { kind: 'created', staff, newUserId };
};

// Correcting a mistyped email of a staff member without a login: attach the matching login of this
// hospital if there is one (the link itself never depends on the email afterwards).
export const buildStaffUpdate = async (
  updateData: Record<string, unknown>,
  existing: { userId: string | null },
  hospitalId: string,
): Promise<Prisma.StaffUncheckedUpdateInput> => {
  const data: Prisma.StaffUncheckedUpdateInput = { ...updateData };
  if (typeof updateData.email === 'string' && !existing.userId) {
    const candidate = await prisma.user.findFirst({
      where: { hospitalId, email: { equals: updateData.email, mode: 'insensitive' }, staff: null },
      select: { id: true },
    });
    if (candidate) data.userId = candidate.id;
  }
  return data;
};

export type LinkLoginOutcome =
  | { kind: 'staff-not-found' }
  | { kind: 'user-not-found' }
  | { kind: 'already-linked' }
  | { kind: 'ok'; staff: Prisma.StaffGetPayload<object> };

// Link a login (User of the same hospital) to a staff member, or unlink with null.
export const linkStaffLogin = async (id: string, userId: string | null, hospitalId: string): Promise<LinkLoginOutcome> => {
  const existing = await prisma.staff.findFirst({ where: { id, hospitalId }, select: { id: true } });
  if (!existing) return { kind: 'staff-not-found' };

  if (userId !== null) {
    const user = await prisma.user.findFirst({
      where: { id: userId, hospitalId },
      select: { id: true, staff: { select: { id: true } } },
    });
    if (!user) return { kind: 'user-not-found' };
    if (user.staff && user.staff.id !== id) return { kind: 'already-linked' };
  }

  const staff = await prisma.staff.update({ where: { id }, data: { userId } });
  return { kind: 'ok', staff };
};

export type TimelineEntry = {
  id: string;
  staffName: string;
  role: string;
  avatar: string | null;
  type: string;
  startTime: Date;
  endTime: Date;
  notes: string | null;
};

export const buildShiftWhere = (
  hospitalId: string,
  q: { department?: unknown; staffId?: unknown; date?: unknown },
): Prisma.ShiftWhereInput => {
  const where: Prisma.ShiftWhereInput = { staff: { hospitalId } };
  if (q.department) where.department = q.department as string;
  if (q.staffId) where.staffId = q.staffId as string;
  if (q.date) {
    const d = new Date(q.date as string);
    where.startTime = { gte: d };
    where.endTime = { lte: new Date(d.getTime() + 24 * 60 * 60 * 1000) };
  }
  return where;
};

interface TimelineShift {
  id: string;
  department: string;
  type: string;
  startTime: Date;
  endTime: Date;
  notes: string | null;
  staff: { name: string; role: string; avatar: string | null };
}

// Group shifts by department.
export const groupShiftTimeline = (shifts: TimelineShift[]): Record<string, TimelineEntry[]> =>
  shifts.reduce<Record<string, TimelineEntry[]>>((acc, shift) => {
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
