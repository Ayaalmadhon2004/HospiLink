import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { pageParams, pageInfo } from '../utils/pagination';
import { ok, fail } from '../utils/apiResponse';

const duplicate = (error: unknown): boolean => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

// GET /api/medications?active=true&q=para
export const listMedications = async (req: Request, res: Response) => {
  try {
    const { active, q } = req.query as { active?: 'true' | 'false'; q?: string };
    const where: Prisma.MedicationWhereInput = {
      hospitalId: hospitalIdOf(req),
      ...(active ? { active: active === 'true' } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { genericName: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const page = pageParams(req.query);
    const [rows, totalCount] = await Promise.all([
      prisma.medication.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: page.skip, take: page.take }),
      prisma.medication.count({ where }),
    ]);
    return ok(res, rows, { count: rows.length, pagination: pageInfo(page, totalCount) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List medications error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load medications');
  }
};

// POST /api/medications (ADMIN, DOCTOR)
export const createMedication = async (req: Request, res: Response) => {
  try {
    const { name, genericName, form, strength, reorderLevel, unitPriceMinor } = req.body;
    const med = await prisma.medication.create({ data: { hospitalId: hospitalIdOf(req), name, genericName: genericName ?? null, form, strength, reorderLevel: reorderLevel ?? 0, unitPriceMinor: unitPriceMinor ?? 0 } });
    return ok(res, med, {}, 201);
  } catch (error: unknown) {
    if (duplicate(error)) return fail(res, 409, 'CONFLICT', 'This medication (name, form, strength) already exists');
    logger.error({ err: error }, 'Create medication error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to create medication');
  }
};

// PUT /api/medications/:id (ADMIN, DOCTOR). Retire with { active: false }; there is no delete (prescriptions reference it).
export const updateMedication = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.medication.findFirst({ where: { id, hospitalId: hospitalIdOf(req) }, select: { id: true } });
    if (!existing) return fail(res, 404, 'NOT_FOUND', 'Medication not found');
    const med = await prisma.medication.update({ where: { id }, data: req.body });
    return ok(res, med);
  } catch (error: unknown) {
    if (duplicate(error)) return fail(res, 409, 'CONFLICT', 'This medication (name, form, strength) already exists');
    logger.error({ err: error }, 'Update medication error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to update medication');
  }
};
