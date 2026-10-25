import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { ok, fail } from '../utils/apiResponse';

const WITH_BED_COUNT = { _count: { select: { beds: true } } } as const;

const nameTaken = async (hospitalId: string, name: string, exceptId?: string): Promise<boolean> =>
  !!(await prisma.ward.findFirst({
    where: { hospitalId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  }));

// GET /api/wards - كل الأقسام
export const getAllWards = async (req: Request, res: Response) => {
  try {
    const wards = await prisma.ward.findMany({
      where: { hospitalId: hospitalIdOf(req) },
      include: WITH_BED_COUNT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    res.status(200).json({ success: true, data: wards });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Ward error:');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// POST /api/wards (ADMIN)
export const createWard = async (req: Request, res: Response) => {
  try {
    const hospitalId = hospitalIdOf(req);
    const { name, floor } = req.body as { name: string; floor?: number };
    if (await nameTaken(hospitalId, name)) return fail(res, 409, 'CONFLICT', 'A ward with this name already exists');
    const ward = await prisma.ward.create({ data: { name, floor: floor ?? null, hospitalId }, include: WITH_BED_COUNT });
    return ok(res, ward, {}, 201);
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create ward error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to create ward');
  }
};

// PUT /api/wards/:id (ADMIN)
export const updateWard = async (req: Request, res: Response) => {
  try {
    const hospitalId = hospitalIdOf(req);
    const id = req.params.id as string;
    const existing = await prisma.ward.findFirst({ where: { id, hospitalId }, select: { id: true } });
    if (!existing) return fail(res, 404, 'WARD_NOT_FOUND', 'Ward not found');
    const { name, floor } = req.body as { name?: string; floor?: number | null };
    if (name !== undefined && (await nameTaken(hospitalId, name, id))) return fail(res, 409, 'CONFLICT', 'A ward with this name already exists');
    const ward = await prisma.ward.update({
      where: { id },
      data: { ...(name !== undefined ? { name } : {}), ...(floor !== undefined ? { floor } : {}) },
      include: WITH_BED_COUNT,
    });
    return ok(res, ward);
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update ward error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to update ward');
  }
};

// DELETE /api/wards/:id (ADMIN). Bed -> Ward is Restrict: a ward with beds is refused (409), never cascaded.
export const deleteWard = async (req: Request, res: Response) => {
  try {
    const hospitalId = hospitalIdOf(req);
    const id = req.params.id as string;
    const ward = await prisma.ward.findFirst({ where: { id, hospitalId }, include: WITH_BED_COUNT });
    if (!ward) return fail(res, 404, 'WARD_NOT_FOUND', 'Ward not found');
    if (ward._count.beds > 0) return fail(res, 409, 'WARD_HAS_BEDS', 'Move or delete the ward\'s beds first');
    await prisma.ward.delete({ where: { id } });
    return ok(res, { id });
  } catch (error: unknown) {
    // A bed created between the check and the delete trips the Restrict FK.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return fail(res, 409, 'WARD_HAS_BEDS', 'Move or delete the ward\'s beds first');
    }
    logger.error({ err: error }, 'Delete ward error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to delete ward');
  }
};
