// backend/src/validators/pharmacy.validator.ts
import { z } from 'zod';
import { idSchema, digitsString, enumValue } from './common.validator';
import { StockMovementType } from '@prisma/client';

const qty = z.coerce.number().int().min(1).max(1_000_000);
const page = { page: digitsString.optional(), limit: digitsString.optional() };

export const stockQuery = z.object({ lowOnly: z.enum(['true']).optional(), q: z.string().trim().max(100).optional(), ...page });
export const receiveSchema = z.object({ medicationId: idSchema, quantity: qty, note: z.string().trim().max(500).nullable().optional() });
export const adjustSchema = z.object({
  medicationId: idSchema,
  delta: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, 'delta must not be 0'),
  note: z.string().trim().min(3, 'a reason is required').max(500),
});
export const dispenseSchema = z.object({ prescriptionItemId: idSchema, quantity: qty });
export const movementsQuery = z.object({ medicationId: idSchema.optional(), type: enumValue(StockMovementType, 'type').optional(), ...page });
export const dispensationsQuery = z.object({ patientId: idSchema, ...page });
export const queueQuery = z.object({ q: z.string().trim().max(100).optional(), ...page });
