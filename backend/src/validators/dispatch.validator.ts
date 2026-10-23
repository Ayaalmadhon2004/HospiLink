// backend/src/validators/dispatch.validator.ts
import { z } from 'zod';
import { idSchema, nonEmpty } from './common.validator';

export const unitStatusEnum = z.enum(['AVAILABLE', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'OFF_DUTY']);
export const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// location may be a string or a {lat,lng}-style object (controller JSON.stringify()s it).
export const updateUnitStatusSchema = z.object({
  status: unitStatusEnum.optional(),
  location: z.union([z.string().trim().max(500), z.record(z.string(), z.unknown())]).optional(),
  eta: z.number().int().min(0).max(100000).nullable().optional(),
  callId: idSchema.nullable().optional(),
});

export const createCallSchema = z.object({
  type: nonEmpty('type', 100),
  location: nonEmpty('location', 300),
  priority: priorityEnum.optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const assignUnitSchema = z.object({ unitId: idSchema });

export const callStatusEnum = z.enum(['PENDING', 'ASSIGNED', 'EN_ROUTE', 'ON_SCENE', 'COMPLETED', 'CANCELLED']);
export const listCallsQuery = z.object({ status: callStatusEnum.optional() });
