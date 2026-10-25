// backend/src/validators/ward.validator.ts
import { z } from 'zod';
import { nonEmpty, looseNumber } from './common.validator';

// hospitalId is not accepted: the ward always belongs to the caller's hospital.
export const createWardSchema = z.object({
  name: nonEmpty('name', 100),
  floor: looseNumber(-5, 200, { int: true }),
});

export const updateWardSchema = z.object({
  name: nonEmpty('name', 100).optional(),
  // null clears the floor; looseNumber maps ''/null to undefined, so null is accepted explicitly here.
  floor: z.union([looseNumber(-5, 200, { int: true }), z.null()]).optional(),
});
