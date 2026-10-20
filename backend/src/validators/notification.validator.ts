// backend/src/validators/notification.validator.ts
import { z } from 'zod';
import { digitsString } from './common.validator';

export const notificationsQuerySchema = z.object({
  limit: digitsString.refine((v) => Number(v) >= 1 && Number(v) <= 200, 'limit must be between 1 and 200').optional(),
  unreadOnly: z.enum(['true', 'false']).optional(),
});
