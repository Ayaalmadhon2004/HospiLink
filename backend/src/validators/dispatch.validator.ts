// backend/src/validators/dispatch.validator.ts
import { z } from 'zod';
import { idSchema, nonEmpty } from './common.validator';

export const unitStatusEnum = z.enum(['AVAILABLE', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'OFF_DUTY']);
export const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// location may be a string or a {lat,lng}-style object (controller JSON.stringify()s it).
// callId is deliberately NOT accepted (zod strips it): the unit <-> call link only changes through
// assign / complete / cancel, so a unit and its call can never disagree.
export const updateUnitStatusSchema = z.object({
  status: unitStatusEnum.optional(),
  location: z.union([z.string().trim().max(500), z.record(z.string(), z.unknown())]).optional(),
  eta: z.number().int().min(0).max(100000).nullable().optional(),
});

export const unitTypeEnum = z.enum(['AMBULANCE', 'PARAMEDIC', 'HELICOPTER', 'FIRE_TRUCK', 'POLICE']);

const unitFields = {
  unitCode: nonEmpty('unitCode', 50),
  unitType: unitTypeEnum,
  department: nonEmpty('department', 100),
  crew: z.array(z.string().trim().min(1).max(100)).max(20),
};
export const createUnitSchema = z.object({
  ...unitFields,
  department: unitFields.department.optional(),
  crew: unitFields.crew.optional(),
});
export const updateUnitSchema = z.object({
  unitCode: unitFields.unitCode.optional(),
  unitType: unitFields.unitType.optional(),
  department: unitFields.department.optional(),
  crew: unitFields.crew.optional(),
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
