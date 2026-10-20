// backend/src/validators/settings.validator.ts
import { z } from 'zod';

// Profile: id/email/role/status sent back by the UI are stripped (not editable here).
export const updateProfileSchema = z.object({
  name: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  shift: z.string().trim().max(50).optional(),
});

export const updateNotificationSettingsSchema = z.object({
  criticalVitalsAlerts: z.boolean().optional(),
  incidentEscalations: z.boolean().optional(),
  shiftReminders: z.boolean().optional(),
  dispatchAlerts: z.boolean().optional(),
  appointmentReminders: z.boolean().optional(),
});

export const updateSecuritySettingsSchema = z.object({
  twoFactorAuth: z.boolean().optional(),
  autoLockIdleSessions: z.boolean().optional(),
  compactDensity: z.boolean().optional(),
});

export const updateDisplaySettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().trim().min(2).max(10).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});
