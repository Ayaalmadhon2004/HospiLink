// backend/src/services/bedAssignment.ts
//
// One rule keeps beds and patients consistent: a bed is OCCUPIED if and only if a patient is assigned to it
// (Patient.bedId). Every place that changes either side goes through these helpers, inside a transaction.
import type { Prisma } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

/** A business-rule failure that is safe to show to the client. */
export class BedRuleError extends Error {
  constructor(readonly status: 400 | 404 | 409, message: string) {
    super(message);
  }
}

/**
 * Takes a bed for a patient: only an AVAILABLE bed with nobody in it can be claimed, atomically, so two concurrent
 * requests cannot both get it (the loser gets 409). Marks the bed OCCUPIED.
 */
export const claimBed = async (tx: Tx, bedId: string, hospitalId: string): Promise<void> => {
  const { count } = await tx.bed.updateMany({
    where: { id: bedId, hospitalId, status: 'AVAILABLE', patient: { is: null } },
    data: { status: 'OCCUPIED' },
  });
  if (count > 0) return;
  const exists = await tx.bed.findFirst({ where: { id: bedId, hospitalId }, select: { id: true } });
  throw exists ? new BedRuleError(409, 'Bed is not available') : new BedRuleError(404, 'Bed not found');
};

/** Frees a bed whose patient left (moved or discharged). */
export const releaseBed = async (tx: Tx, bedId: string, hospitalId: string): Promise<void> => {
  await tx.bed.updateMany({ where: { id: bedId, hospitalId }, data: { status: 'AVAILABLE' } });
};
