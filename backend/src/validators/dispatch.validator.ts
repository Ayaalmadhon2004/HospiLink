// backend/src/validators/dispatch.validator.ts
import { z } from 'zod';
import { idSchema, nonEmpty } from './common.validator';

export const unitStatusEnum = z.enum(['AVAILABLE', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'OFF_DUTY']);
export const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// lat/lng are the unit's last known position (dedicated float columns).
// callId is deliberately NOT accepted (zod strips it): the unit <-> call link only changes through
// assign / complete / cancel, so a unit and its call can never disagree.
export const updateUnitStatusSchema = z.object({
  status: unitStatusEnum.optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  eta: z.number().int().min(0).max(100000).nullable().optional(),
});

export const unitTypeEnum = z.enum(['AMBULANCE', 'PARAMEDIC', 'HELICOPTER', 'FIRE_TRUCK', 'POLICE']);

const unitFields = {
  unitCode: nonEmpty('unitCode', 50),
  unitType: unitTypeEnum,
  department: nonEmpty('department', 100),
  // Staff ids of the crew (same hospital); replaces the whole crew on update.
  crewIds: z.array(idSchema).max(20),
};
export const createUnitSchema = z.object({
  ...unitFields,
  department: unitFields.department.optional(),
  crewIds: unitFields.crewIds.optional(),
});
export const updateUnitSchema = z.object({
  unitCode: unitFields.unitCode.optional(),
  unitType: unitFields.unitType.optional(),
  department: unitFields.department.optional(),
  crewIds: unitFields.crewIds.optional(),
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
