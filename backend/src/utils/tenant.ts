// backend/src/utils/tenant.ts
//
// Multi-tenancy: the hospital of a request is the hospital of the authenticated user, loaded from
// the DB by `protect`. It is never read from req.body, req.query or req.params.
import type { Request } from 'express';

export const hospitalIdOf = (req: Request): string => {
  const hospitalId = req.user?.hospitalId;
  // Only reachable if a route forgot `protect`; fail closed instead of running an unscoped query.
  if (!hospitalId) throw new Error('Tenant context missing: route is not behind protect');
  return hospitalId;
};

// Socket.io rooms are per hospital so events never cross tenants.
export const hospitalRoom = (hospitalId: string, room: string): string => `h-${hospitalId}:${room}`;

export const clinicalRoom = (hospitalId: string): string => hospitalRoom(hospitalId, 'clinical-staff');
export const departmentRoom = (hospitalId: string, department: string): string => hospitalRoom(hospitalId, `department-${department}`);
export const dispatchRoom = (hospitalId: string): string => hospitalRoom(hospitalId, 'dispatch-room');
export const unitRoom = (hospitalId: string, unitId: string): string => hospitalRoom(hospitalId, `unit-${unitId}`);
