import { Request, Response } from 'express';
import { Prisma, PrescriptionStatus } from '@prisma/client';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { pageParams, pageInfo } from '../utils/pagination';
import { ok, fail } from '../utils/apiResponse';
import { findTenantPatient, actorOf } from '../services/clinicalAccess';

const WITH_ITEMS = { items: { include: { medication: { select: { id: true, name: true, form: true, strength: true } } } } } satisfies Prisma.PrescriptionInclude;

// GET /api/prescriptions?patientId=&status=
export const listPrescriptions = async (req: Request, res: Response) => {
  try {
    const q = req.query as { patientId: string; status?: PrescriptionStatus };
    const where: Prisma.PrescriptionWhereInput = {
      hospitalId: hospitalIdOf(req), patientId: q.patientId, patient: { deletedAt: null }, ...(q.status ? { status: q.status } : {}),
    };
    const page = pageParams(req.query);
    const [rows, totalCount] = await Promise.all([
      prisma.prescription.findMany({ where, include: WITH_ITEMS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page.skip, take: page.take }),
      prisma.prescription.count({ where }),
    ]);
    return ok(res, rows, { count: rows.length, pagination: pageInfo(page, totalCount) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List prescriptions error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load prescriptions');
  }
};

// POST /api/prescriptions (DOCTOR). Every medication must be an ACTIVE entry of this hospital's catalogue.
export const createPrescription = async (req: Request, res: Response) => {
  try {
    const { patientId, notes, items } = req.body as {
      patientId: string; notes?: string | null;
      items: { medicationId: string; dose: string; frequency: string; route?: string | null; durationDays?: number; instructions?: string | null }[];
    };
    const hospitalId = hospitalIdOf(req);
    const patient = await findTenantPatient(req, patientId);
    if (!patient) return fail(res, 404, 'PATIENT_NOT_FOUND', 'Patient not found');

    const ids = [...new Set(items.map((i) => i.medicationId))];
    const usable = await prisma.medication.count({ where: { id: { in: ids }, hospitalId, active: true } });
    if (usable !== ids.length) return fail(res, 400, 'VALIDATION_ERROR', 'Unknown or inactive medication in the prescription');

    const actor = await actorOf(req);
    const rx = await prisma.prescription.create({
      data: {
        hospitalId, patientId, notes: notes ?? null, prescriberId: actor.id, prescriberName: actor.name,
        items: { create: items.map((i) => ({ medicationId: i.medicationId, dose: i.dose, frequency: i.frequency, route: i.route ?? null, durationDays: i.durationDays ?? null, instructions: i.instructions ?? null })) },
      },
      include: WITH_ITEMS,
    });
    return ok(res, rx, {}, 201);
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create prescription error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to create prescription');
  }
};

// PUT /api/prescriptions/:id/status (DOCTOR) - ACTIVE -> COMPLETED | CANCELLED. Closed prescriptions never reopen.
export const closePrescription = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const hospitalId = hospitalIdOf(req);
    const rx = await prisma.prescription.findFirst({ where: { id, hospitalId, patient: { deletedAt: null } }, select: { id: true } });
    if (!rx) return fail(res, 404, 'NOT_FOUND', 'Prescription not found');
    // The status is in the WHERE clause so two doctors closing it at once cannot both succeed.
    const { count } = await prisma.prescription.updateMany({ where: { id, hospitalId, status: 'ACTIVE' }, data: { status: req.body.status, closedAt: new Date() } });
    if (count === 0) return fail(res, 409, 'CONFLICT', 'The prescription is already closed');
    return ok(res, await prisma.prescription.findFirst({ where: { id, hospitalId }, include: WITH_ITEMS }));
  } catch (error: unknown) {
    logger.error({ err: error }, 'Close prescription error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to update prescription');
  }
};
