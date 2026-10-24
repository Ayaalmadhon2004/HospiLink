// backend/src/validators/settings.validator.ts
import { z } from 'zod';
import { ShiftType } from '@prisma/client';
import { enumValue } from './common.validator';

// Profile: id/email/role/status sent back by the UI are stripped (not editable here).
// The columns are NOT NULL, so a provided value must be non-empty; omit a field to leave it unchanged.
export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
    department: z.string().trim().min(1, 'Department cannot be empty').max(100).optional(),
    shift: enumValue(ShiftType, 'Shift').optional(),
  })
  .refine((v) => v.name !== undefined || v.department !== undefined || v.shift !== undefined, {
    message: 'Provide at least one of name, department or shift',
  });

export const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const updateNotificationSettingsSchema = z.object({
  criticalVitalsAlerts: z.boolean().optional(),
  incidentEscalations: z.boolean().optional(),
  shiftReminders: z.boolean().optional(),
  dispatchAlerts: z.boolean().optional(),
  appointmentReminders: z.boolean().optional(),
});

export const updateSecuritySettingsSchema = z.object({
  // Managed only through /api/auth/2fa/*; a toggle sent here must never be silently ignored.
  twoFactorAuth: z.never({ message: 'Manage two-factor authentication via /api/auth/2fa' }).optional(),
  autoLockIdleSessions: z.boolean().optional(),
  compactDensity: z.boolean().optional(),
});

export const updateDisplaySettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().trim().min(2).max(10).optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isValidTimeZone, { message: 'Invalid IANA time zone' })
    .optional(),
});

// Hospital-wide clock: "today" ranges and times in notifications follow this zone.
export const updateHospitalSettingsSchema = z.object({
  timezone: z.string().trim().min(1).max(64).refine(isValidTimeZone, { message: 'Invalid IANA time zone' }),
});
