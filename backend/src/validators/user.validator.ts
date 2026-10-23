// backend/src/validators/user.validator.ts
import { z } from 'zod';
import { nonEmpty } from './common.validator';

export const roleEnum = z.enum(['ADMIN', 'DOCTOR', 'NURSE', 'DISPATCHER']);
const accountStatusEnum = z.enum(['PENDING', 'ACTIVE', 'DISABLED']);

// hospitalId is deliberately absent: users are always created in the admin's own hospital.
export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  role: roleEnum,
  department: nonEmpty('department', 100),
  shift: nonEmpty('shift', 50),
});

// The admin must pick the role explicitly: the PENDING row only holds a placeholder.
export const approveUserSchema = z.object({
  role: roleEnum,
  department: nonEmpty('department', 100).optional(),
});

export const listUsersQuerySchema = z.object({
  accountStatus: accountStatusEnum.optional(),
});
