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
  // null clears the floor. z.null() must come FIRST: looseNumber maps null to "not provided", which would swallow it
  // and silently leave the old floor in place (found by frontend/e2e-real/admin-modules.e2e.ts).
  floor: z.union([z.null(), looseNumber(-5, 200, { int: true })]).optional(),
});
