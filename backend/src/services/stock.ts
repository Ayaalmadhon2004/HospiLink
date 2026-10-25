// backend/src/services/stock.ts
//
// The only place that changes Medication.stockQuantity. Every change is one conditional UPDATE (so two concurrent
// dispenses cannot both take the last box) plus one StockMovement ledger row, inside the caller's transaction.
import type { Prisma, StockMovementType } from '@prisma/client';

export class InsufficientStockError extends Error {}
export class MedicationMissingError extends Error {}

type Tx = Prisma.TransactionClient;

export interface StockChange {
  hospitalId: string;
  medicationId: string;
  /** Positive = stock in, negative = stock out. Never 0. */
  delta: number;
  type: StockMovementType;
  note?: string | null;
  user: { id: string; name: string };
}

export const changeStock = async (tx: Tx, c: StockChange): Promise<void> => {
  const where: Prisma.MedicationWhereInput = { id: c.medicationId, hospitalId: c.hospitalId };
  if (c.delta < 0) where.stockQuantity = { gte: -c.delta }; // atomic "enough on hand" check
  const { count } = await tx.medication.updateMany({ where, data: { stockQuantity: { increment: c.delta } } });
  if (count === 0) {
    const exists = await tx.medication.findFirst({ where: { id: c.medicationId, hospitalId: c.hospitalId }, select: { id: true } });
    throw exists ? new InsufficientStockError() : new MedicationMissingError();
  }
  await tx.stockMovement.create({
    data: { hospitalId: c.hospitalId, medicationId: c.medicationId, type: c.type, delta: c.delta, note: c.note ?? null, userId: c.user.id, userName: c.user.name },
  });
};
