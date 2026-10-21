// backend/src/validators/notification.validator.ts
import { z } from 'zod';
import { digitsString, nonEmpty } from './common.validator';

export const notificationsQuerySchema = z.object({
  limit: digitsString.refine((v) => Number(v) >= 1 && Number(v) <= 200, 'limit must be between 1 and 200').optional(),
  unreadOnly: z.enum(['true', 'false']).optional(),
});

export const broadcastSchema = z.object({
  title: nonEmpty('title', 120),
  message: nonEmpty('message', 1000),
  role: z.enum(['ADMIN', 'DOCTOR', 'NURSE', 'DISPATCHER']).optional(),
  // Accepts internal paths only: "/incidents" matches, "//evil.com" and "https://x" are rejected.
  link: z.string().trim().max(200).regex(/^\/(?!\/)/, 'link must be an internal path starting with /').optional(),
});
