// backend/src/validators/staff.validator.ts
import { z } from 'zod';
import { idSchema, nonEmpty, dateString } from './common.validator';

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

export const createStaffSchema = z.object(staffFields).transform(withIsActive);
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
  type: nonEmpty('type', 50),
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
