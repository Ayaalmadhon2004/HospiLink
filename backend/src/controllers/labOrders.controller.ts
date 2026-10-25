import { Request, Response } from 'express';
import { Prisma, LabOrderStatus } from '@prisma/client';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { pageParams, pageInfo } from '../utils/pagination';
import { ok, fail } from '../utils/apiResponse';
import { findTenantPatient, actorOf } from '../services/clinicalAccess';
import { flagFor, isCritical, type LabLimits } from '../services/labFlags';
import { notify } from '../services/notification.service';

const WITH_RESULTS = { results: { orderBy: { analyte: 'asc' as const } } } satisfies Prisma.LabOrderInclude;

// GET /api/lab-orders?patientId=&status=
export const listLabOrders = async (req: Request, res: Response) => {
  try {
    const q = req.query as { patientId: string; status?: LabOrderStatus };
    const where: Prisma.LabOrderWhereInput = {
      hospitalId: hospitalIdOf(req), patientId: q.patientId, patient: { deletedAt: null }, ...(q.status ? { status: q.status } : {}),
    };
    const page = pageParams(req.query);
    const [rows, totalCount] = await Promise.all([
      prisma.labOrder.findMany({ where, include: WITH_RESULTS, orderBy: [{ orderedAt: 'desc' }, { id: 'desc' }], skip: page.skip, take: page.take }),
      prisma.labOrder.count({ where }),
    ]);
    return ok(res, rows, { count: rows.length, pagination: pageInfo(page, totalCount) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'List lab orders error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to load lab orders');
  }
};

// POST /api/lab-orders (DOCTOR)
export const createLabOrder = async (req: Request, res: Response) => {
  try {
    const { patientId, testName, testCode, priority, notes } = req.body;
    const patient = await findTenantPatient(req, patientId);
    if (!patient) return fail(res, 404, 'PATIENT_NOT_FOUND', 'Patient not found');
    const actor = await actorOf(req);
    const order = await prisma.labOrder.create({
      data: { hospitalId: hospitalIdOf(req), patientId, testName, testCode: testCode ?? null, priority, notes: notes ?? null, orderedById: actor.id, orderedByName: actor.name },
      include: WITH_RESULTS,
    });
    return ok(res, order, {}, 201);
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create lab order error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to create lab order');
  }
};

interface ResultInput extends LabLimits { analyte: string; value?: number; textValue?: string | null; unit?: string | null }

// POST /api/lab-orders/:id/results (DOCTOR, NURSE). Results are entered once (ORDERED -> RESULTED); flags are computed here.
export const submitResults = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const hospitalId = hospitalIdOf(req);
    const results = (req.body as { results: ResultInput[] }).results;
    const order = await prisma.labOrder.findFirst({
      where: { id, hospitalId, patient: { deletedAt: null } },
      select: { id: true, testName: true, patient: { select: { id: true, name: true, department: true, hospitalId: true, doctor: { select: { userId: true } } } } },
    });
    if (!order) return fail(res, 404, 'NOT_FOUND', 'Lab order not found');

    const rows = results.map((r) => ({
      labOrderId: id, analyte: r.analyte, value: r.value ?? null, textValue: r.textValue ?? null, unit: r.unit ?? null,
      refLow: r.refLow ?? null, refHigh: r.refHigh ?? null, criticalLow: r.criticalLow ?? null, criticalHigh: r.criticalHigh ?? null,
      flag: flagFor(r.value, r),
    }));

    const done = await prisma.$transaction(async (tx) => {
      const { count } = await tx.labOrder.updateMany({ where: { id, hospitalId, status: 'ORDERED' }, data: { status: 'RESULTED', resultedAt: new Date() } });
      if (count === 0) return false;
      await tx.labResult.createMany({ data: rows });
      return true;
    });
    if (!done) return fail(res, 409, 'CONFLICT', 'Results were already entered or the order was cancelled');

    const critical = rows.filter((r) => isCritical(r.flag));
    if (critical.length > 0) {
      await notify({
        type: 'SYSTEM',
        title: 'Critical lab result',
        message: `${order.patient.name} (${order.patient.department}): ${critical.map((r) => r.analyte).join(', ')} - ${order.testName}`,
        link: `/patients/${order.patient.id}`,
        recipients: {
          roles: ['DOCTOR', 'NURSE'], department: order.patient.department,
          userIds: order.patient.doctor?.userId ? [order.patient.doctor.userId] : [], hospitalId, scopeUserId: req.user?.id,
        },
      });
    }
    return ok(res, await prisma.labOrder.findFirst({ where: { id, hospitalId }, include: WITH_RESULTS }));
  } catch (error: unknown) {
    logger.error({ err: error }, 'Submit lab results error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to save lab results');
  }
};

// PUT /api/lab-orders/:id/cancel (DOCTOR) - only while still ORDERED
export const cancelLabOrder = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const hospitalId = hospitalIdOf(req);
    const order = await prisma.labOrder.findFirst({ where: { id, hospitalId, patient: { deletedAt: null } }, select: { id: true } });
    if (!order) return fail(res, 404, 'NOT_FOUND', 'Lab order not found');
    const { count } = await prisma.labOrder.updateMany({ where: { id, hospitalId, status: 'ORDERED' }, data: { status: 'CANCELLED' } });
    if (count === 0) return fail(res, 409, 'CONFLICT', 'Only an order that is still waiting for results can be cancelled');
    return ok(res, { id, status: 'CANCELLED' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Cancel lab order error:');
    return fail(res, 500, 'INTERNAL_ERROR', 'Failed to cancel lab order');
  }
};
