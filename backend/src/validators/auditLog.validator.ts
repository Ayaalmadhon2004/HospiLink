// backend/src/validators/auditLog.validator.ts
import { z } from 'zod';
import { idSchema, dateString, digitsString } from './common.validator';

// hospitalId is never accepted: the trail is always the caller's hospital.
export const auditLogQuerySchema = z.object({
  page: digitsString.optional(),
  limit: digitsString.optional(),
  action: z.string().trim().min(1).max(100).optional(),
  userId: idSchema.optional(),
  entityId: z.string().trim().min(1).max(100).optional(),
  from: dateString('from').optional(),
  to: dateString('to').optional(),
});
