// backend/src/validators/exports.validator.ts
import { z } from 'zod';
import { dateString } from './common.validator';
import { EXPORT_TYPES, EXPORT_FORMATS } from '../services/exports/types';

export const exportParams = z.object({ type: z.enum(EXPORT_TYPES) });
// hospitalId is never accepted. `to` is exclusive; both default to "the last 30 days".
export const exportQuery = z.object({
  format: z.enum(EXPORT_FORMATS).default('xlsx'),
  from: dateString('from').optional(),
  to: dateString('to').optional(),
});
