// backend/src/validators/staff.validator.ts
import { z } from 'zod';
import { ShiftType } from '@prisma/client';
import { idSchema, nonEmpty, dateString, enumValue } from './common.validator';

const staffStatus = z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE']);

// The UI form also sends status / shiftStart / shiftEnd, which are not Staff columns:
// they are stripped, and status is mapped to the real `isActive` column.
const withIsActive = <T extends { status?: string; isActive?: boolean }>(v: T) => {
  const { status, ...rest } = v;
  return status !== undefined && rest.isActive === undefined
    ? { ...rest, isActive: status === 'ACTIVE' }
    : rest;
};

const staffFields = {
  name: nonEmpty('name', 100),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  role: nonEmpty('role', 50),
  department: nonEmpty('department', 100),
  phone: z.string().trim().max(30).nullable().optional(),
  avatar: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  status: staffStatus.optional(),
};

// loginRole (system role) creates a login for the new staff member and emails them a set-password link.
const loginRole = z.enum(['ADMIN', 'DOCTOR', 'NURSE', 'DISPATCHER']);

export const createStaffSchema = z.object({ ...staffFields, loginRole: loginRole.optional() }).transform(withIsActive);

// Link (userId) or unlink (null) the login of a staff member.
export const staffLoginSchema = z.object({ userId: idSchema.nullable() });
export const updateStaffSchema = z
  .object({
    ...staffFields,
    name: staffFields.name.optional(),
    email: staffFields.email.optional(),
    role: staffFields.role.optional(),
    department: staffFields.department.optional(),
  })
  .transform(withIsActive);

const shiftBase = {
  type: enumValue(ShiftType, 'type'),
  startTime: dateString('startTime'),
  endTime: dateString('endTime'),
  department: nonEmpty('department', 100),
  notes: z.string().trim().max(2000).nullable().optional(),
};
const endAfterStart = (v: { startTime?: string; endTime?: string }) =>
  !v.startTime || !v.endTime || Date.parse(v.endTime) > Date.parse(v.startTime);
const endAfterStartMsg = { message: 'endTime must be after startTime', path: ['endTime'] };

export const createShiftSchema = z
  .object({ staffId: idSchema, ...shiftBase })
  .refine(endAfterStart, endAfterStartMsg);

export const updateShiftSchema = z
  .object({
    type: shiftBase.type.optional(),
    startTime: shiftBase.startTime.optional(),
    endTime: shiftBase.endTime.optional(),
    department: shiftBase.department.optional(),
    notes: shiftBase.notes,
  })
  .refine(endAfterStart, endAfterStartMsg);

export const shiftQuerySchema = z.object({
  department: z.string().trim().min(1).max(100).optional(),
  staffId: z.string().trim().min(1).optional(),
  date: dateString('date').optional(),
});

export const shiftTimelineQuerySchema = z.object({ date: dateString('date').optional() });
