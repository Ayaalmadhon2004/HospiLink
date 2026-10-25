import { Request, Response } from 'express';
import type { Prisma, StockMovementType } from '@prisma/client';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { pageParams, pageInfo } from '../utils/pagination';
import { ok, fail } from '../utils/apiResponse';
import { actorOf } from '../services/clinicalAccess';
import { changeStock, InsufficientStockError, MedicationMissingError } from '../services/stock';

const stockErrors = (res: Response, error: unknown): Response | null => {
  if (error instanceof InsufficientStockError) return fail(res, 409, 'INSUFFICIENT_STOCK', 'Not enough stock on hand');
  if (error instanceof MedicationMissingError) return fail(res, 404, 'NOT_FOUND', 'Medication not found');
  return null;
};

// GET /api/pharmacy/stock?lowOnly=true&q=
export const listStock = async (req: Request, res: Response) => {
  try {
    const { lowOnly, q } = req.query as { lowOnly?: 'true'; q?: string };
    const where: Prisma.MedicationWhereInput = {
      hospitalId: hospitalIdOf(req),
      active: true,
      ...(lowOnly ? { stockQuantity: { lte: prisma.medication.fields.reorderLevel } } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { genericName: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const page = pageParams(req.query);
    const [rows, totalCount] = await Promise.all([
      prisma.medication.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: page.skip, take: page.take }),
      prisma.medication.count({ where }),
    ]);
    return ok(res, rows, { count: rows.length, pagination: pageInfo(page, totalCount) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List stock error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load stock');
  }
};

const move = (type: StockMovementType, sign: 1 | 0) => async (req: Request, res: Response) => {
  try {
    const b = req.body as { medicationId: string; quantity?: number; delta?: number; note?: string | null };
    const user = await actorOf(req);
    const delta = sign === 1 ? (b.quantity as number) : (b.delta as number);
    await prisma.$transaction((tx) => changeStock(tx, { hospitalId: hospitalIdOf(req), medicationId: b.medicationId, delta, type, note: b.note, user }));
    const med = await prisma.medication.findFirst({ where: { id: b.medicationId, hospitalId: hospitalIdOf(req) } });
    return ok(res, med, {}, 201);
  } catch (error: unknown) {
    const handled = stockErrors(res, error);
    if (handled) return handled;
    logger.error({ err: error }, `Stock ${type} error:`);
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to update stock');
  }
};

// POST /api/pharmacy/receive (ADMIN) - a delivery
export const receiveStock = move('RECEIVE', 1);
// POST /api/pharmacy/adjust (ADMIN) - correction after a count; a reason is mandatory, the result can't go below 0
export const adjustStock = move('ADJUST', 0);

// POST /api/pharmacy/dispense (ADMIN, DOCTOR, NURSE) - hands units of a prescribed item to the patient
export const dispense = async (req: Request, res: Response) => {
  try {
    const { prescriptionItemId, quantity } = req.body as { prescriptionItemId: string; quantity: number };
    const hospitalId = hospitalIdOf(req);
    const item = await prisma.prescriptionItem.findFirst({
      where: { id: prescriptionItemId, prescription: { hospitalId, patient: { deletedAt: null } } },
      select: { id: true, medicationId: true, prescription: { select: { patientId: true, status: true } }, medication: { select: { name: true, active: true } } },
    });
    if (!item) return fail(res, 404, 'NOT_FOUND', 'Prescription item not found');
    if (item.prescription.status !== 'ACTIVE') return fail(res, 409, 'CONFLICT', 'Only an active prescription can be dispensed');
    if (!item.medication.active) return fail(res, 409, 'CONFLICT', 'This medication has been retired');

    const user = await actorOf(req);
    const dispensation = await prisma.$transaction(async (tx) => {
      await changeStock(tx, { hospitalId, medicationId: item.medicationId, delta: -quantity, type: 'DISPENSE', note: `Prescription item ${item.id}`, user });
      const med = await tx.medication.findFirst({ where: { id: item.medicationId, hospitalId }, select: { unitPriceMinor: true } });
      return tx.dispensation.create({
        data: {
          hospitalId, patientId: item.prescription.patientId, prescriptionItemId: item.id, medicationId: item.medicationId,
          quantity, unitPriceMinor: med?.unitPriceMinor ?? 0, dispensedById: user.id, dispensedByName: user.name,
        },
      });
    });
    return ok(res, dispensation, {}, 201);
  } catch (error: unknown) {
    const handled = stockErrors(res, error);
    if (handled) return handled;
    logger.error({ err: error }, 'Dispense error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to dispense');
  }
};

// GET /api/pharmacy/dispensations?patientId=
export const listDispensations = async (req: Request, res: Response) => {
  try {
    const where: Prisma.DispensationWhereInput = { hospitalId: hospitalIdOf(req), patientId: (req.query as { patientId: string }).patientId, patient: { deletedAt: null } };
    const page = pageParams(req.query);
    const [rows, totalCount] = await Promise.all([
      prisma.dispensation.findMany({
        where, include: { medication: { select: { name: true, form: true, strength: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page.skip, take: page.take,
      }),
      prisma.dispensation.count({ where }),
    ]);
    return ok(res, rows, { count: rows.length, pagination: pageInfo(page, totalCount) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List dispensations error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load dispensations');
  }
};

// GET /api/pharmacy/movements?medicationId=&type= (ADMIN) - the stock ledger
export const listMovements = async (req: Request, res: Response) => {
  try {
    const q = req.query as { medicationId?: string; type?: StockMovementType };
    const where: Prisma.StockMovementWhereInput = { hospitalId: hospitalIdOf(req), ...(q.medicationId ? { medicationId: q.medicationId } : {}), ...(q.type ? { type: q.type } : {}) };
    const page = pageParams(req.query);
    const [rows, totalCount] = await Promise.all([
      prisma.stockMovement.findMany({
        where, include: { medication: { select: { name: true, strength: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page.skip, take: page.take,
      }),
      prisma.stockMovement.count({ where }),
    ]);
    return ok(res, rows, { count: rows.length, pagination: pageInfo(page, totalCount) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List movements error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load stock movements');
  }
};
