// backend/src/services/dispatchLifecycle.ts
// Unit <-> call transactions for ambulance dispatch (extracted from dispatch.controller).
import prisma from '../config/db';
import type { CallStatus, Prisma, UnitStatus } from '@prisma/client';

// A unit always travels with its live call and its crew (Staff members linked through Staff.dispatchUnitId).
export const unitInclude = {
  currentCall: true,
  crew: { select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } },
} satisfies Prisma.DispatchUnitInclude;

// Thrown inside transactions to answer with a specific status.
export class LifecycleError extends Error {
  constructor(readonly statusCode: 404 | 409, message: string) {
    super(message);
  }
}

export const isUniqueViolation = (error: unknown): boolean => (error as { code?: unknown })?.code === 'P2002';

// Every crew id must be a Staff of this hospital; returns false when one is unknown or from another hospital.
export const crewBelongsToHospital = async (crewIds: string[], hospitalId: string): Promise<boolean> => {
  const unique = [...new Set(crewIds)];
  return (await prisma.staff.count({ where: { id: { in: unique }, hospitalId } })) === unique.length;
};

// A call that is not finished yet.
const ACTIVE_CALL_STATUSES: CallStatus[] = ['PENDING', 'ASSIGNED', 'EN_ROUTE', 'ON_SCENE'];

// Unit status -> call status, for the statuses the call can mirror (CallStatus has no TRANSPORTING/AT_HOSPITAL).
const CALL_STATUS_FOR_UNIT: Partial<Record<UnitStatus, CallStatus>> = { EN_ROUTE: 'EN_ROUTE', ON_SCENE: 'ON_SCENE' };

export interface UnitStatusInput {
  status?: UnitStatus;
  lat?: number;
  lng?: number;
  eta?: number | null;
}

// Rules: a unit on an active call cannot become AVAILABLE/OFF_DUTY (complete or cancel the call first), and
// EN_ROUTE / ON_SCENE are mirrored on its call. The call link itself is never set from here.
export const updateUnitStatusTx = (id: string, hospitalId: string, { status, lat, lng, eta }: UnitStatusInput) => {
  const freeing = status === 'AVAILABLE' || status === 'OFF_DUTY';

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.dispatchUnit.updateMany({
      // freeing a unit that still has a call matches nothing -> 409 below
      where: { id, hospitalId, ...(freeing ? { currentCallId: null } : {}) },
      data: {
        status,
        lat,
        lng,
        eta,
        lastUpdated: new Date(),
      },
    });
    if (claimed.count === 0) {
      const exists = await tx.dispatchUnit.findFirst({ where: { id, hospitalId }, select: { id: true } });
      throw new LifecycleError(exists ? 409 : 404, exists ? 'Unit is on an active call: complete or cancel the call first' : 'Unit not found');
    }

    const updated = await tx.dispatchUnit.findUniqueOrThrow({ where: { id } });
    const mirrored = status ? CALL_STATUS_FOR_UNIT[status] : undefined;
    if (mirrored && updated.currentCallId) {
      await tx.dispatchCall.updateMany({
        where: { id: updated.currentCallId, hospitalId, status: { in: ACTIVE_CALL_STATUSES } },
        data: { status: mirrored },
      });
    }
    return tx.dispatchUnit.findUniqueOrThrow({ where: { id }, include: unitInclude });
  });
};

// Conditional updates inside one transaction: only a PENDING call and a free AVAILABLE unit
// can be claimed, so concurrent dispatchers cannot double-assign (the loser gets 409).
export const assignUnitTx = (callId: string, unitId: string, hospitalId: string) =>
  prisma.$transaction(async (tx) => {
    const claimedCall = await tx.dispatchCall.updateMany({
      where: { id: callId, hospitalId, status: 'PENDING', assignedUnitId: null },
      data: { assignedUnitId: unitId, status: 'ASSIGNED' },
    });
    if (claimedCall.count === 0) {
      const exists = await tx.dispatchCall.findFirst({ where: { id: callId, hospitalId }, select: { id: true } });
      throw new LifecycleError(exists ? 409 : 404, exists ? 'Call is no longer pending' : 'Call not found');
    }

    const claimedUnit = await tx.dispatchUnit.updateMany({
      where: { id: unitId, hospitalId, status: 'AVAILABLE', currentCallId: null },
      data: { status: 'EN_ROUTE', currentCallId: callId },
    });
    if (claimedUnit.count === 0) {
      const exists = await tx.dispatchUnit.findFirst({ where: { id: unitId, hospitalId }, select: { id: true } });
      throw new LifecycleError(exists ? 409 : 404, exists ? 'Unit is not available' : 'Unit not found');
    }

    return {
      updatedCall: await tx.dispatchCall.findUniqueOrThrow({ where: { id: callId } }),
      updatedUnit: await tx.dispatchUnit.findUniqueOrThrow({ where: { id: unitId }, include: unitInclude }),
    };
  });

// Closes a call (COMPLETED or CANCELLED) and releases its unit in the same transaction, so the unit never stays
// EN_ROUTE on a finished call. An OFF_DUTY unit keeps that status; otherwise it becomes AVAILABLE with no ETA.
export const closeCallTx = (id: string, hospitalId: string, target: 'COMPLETED' | 'CANCELLED') =>
  prisma.$transaction(async (tx) => {
    const claimed = await tx.dispatchCall.updateMany({
      where: { id, hospitalId, status: { in: ACTIVE_CALL_STATUSES } },
      data: { status: target },
    });
    if (claimed.count === 0) {
      const exists = await tx.dispatchCall.findFirst({ where: { id, hospitalId }, select: { id: true } });
      throw new LifecycleError(exists ? 409 : 404, exists ? 'Call is already completed or cancelled' : 'Call not found');
    }

    const closed = await tx.dispatchCall.findUniqueOrThrow({ where: { id } });
    const unitId = closed.assignedUnitId;
    if (!unitId) return { call: closed, unit: null };

    await tx.dispatchUnit.updateMany({ where: { id: unitId, hospitalId, currentCallId: id }, data: { currentCallId: null, eta: null } });
    await tx.dispatchUnit.updateMany({
      where: { id: unitId, hospitalId, currentCallId: null, status: { not: 'OFF_DUTY' } },
      data: { status: 'AVAILABLE' },
    });
    return { call: closed, unit: await tx.dispatchUnit.findFirst({ where: { id: unitId, hospitalId }, include: unitInclude }) };
  });
