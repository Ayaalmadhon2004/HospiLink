// backend/src/validators/bed.validator.ts
import { z } from 'zod';
import { idSchema, nonEmpty } from './common.validator';

export const bedStatusEnum = z.enum(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE']);

export const createBedSchema = z.object({
  bedNumber: nonEmpty('bedNumber', 50),
  wardId: idSchema,
  hospitalId: idSchema,
  status: bedStatusEnum.optional(),
});

// patientId: uuid to assign, null / '' to unassign (see updateBedStatus).
export const updateBedSchema = z.object({
  bedNumber: nonEmpty('bedNumber', 50).optional(),
  wardId: idSchema.optional(),
  hospitalId: idSchema.optional(),
  status: bedStatusEnum.optional(),
  patientId: z.union([idSchema, z.literal(''), z.null()]).optional(),
});
