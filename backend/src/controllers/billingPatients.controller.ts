import { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { ok, fail } from '../utils/apiResponse';

const LIMIT = 50;

// GET /api/billing/patients?q=  (ADMIN, BILLING). Only what an invoice needs: id, name, code. No diagnosis, no contact data.
export const searchBillablePatients = async (req: Request, res: Response) => {
  try {
    const { q } = req.query as { q?: string };
    const where: Prisma.PatientWhereInput = {
      hospitalId: hospitalIdOf(req),
      deletedAt: null,
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { patientCode: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const rows = await prisma.patient.findMany({
      where, select: { id: true, name: true, patientCode: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: LIMIT,
    });
    return ok(res, rows, { count: rows.length });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Billing patient lookup error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load patients');
  }
};
