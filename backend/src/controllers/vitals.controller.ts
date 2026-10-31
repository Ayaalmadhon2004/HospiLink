// backend/src/controllers/vitals.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { getIO } from '../utils/socket';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { pageParams, pageInfo } from '../utils/pagination';
import { loadEffectiveThresholds } from '../services/vitalThresholds';
import { checkCriticalVitals, escalatePatient, notifyCriticalVitals } from '../services/vitalsIngest';
import { mergeMetrics, parseMetrics } from '../services/vitalsParsing';
import type { Prisma } from '@prisma/client';

// `protect` always sets req.user on routed requests; the fallback only covers a call without an authenticated user.
const SYSTEM_RECORDER = 'system';

const invalidMetricsResponse = (res: Response, invalid: string[]) =>
  res.status(400).json({ success: false, message: `Invalid numeric value for: ${invalid.join(', ')}` });

// POST /api/vitals - Record new vitals
export const recordVitals = async (req: Request, res: Response) => {
  try {
    const { patientId, notes } = req.body;
    const { values, invalid } = parseMetrics(req.body);
    if (invalid.length) return invalidMetricsResponse(res, invalid);

    const patient = await prisma.patient.findFirst({
      where: { id: patientId as string, hospitalId: hospitalIdOf(req), deletedAt: null },
      select: { id: true, name: true, department: true, doctor: { select: { userId: true } }, hospitalId: true },
    });

    if (!patient) {
      return res.status(404).json({ success: false, code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
    }

    const { isCritical, alertType } = await checkCriticalVitals(patient.hospitalId, patient.department, values);

    const vitals = await prisma.patientVitals.create({
      data: {
        patientId: patientId as string,
        heartRate: values.heartRate,
        systolicBP: values.systolicBP,
        diastolicBP: values.diastolicBP,
        spO2: values.spO2,
        temperature: values.temperature,
        respiratoryRate: values.respiratoryRate,
        recordedBy: req.user?.id ?? SYSTEM_RECORDER,
        notes,
        isCritical,
        alertType,
      },
    });

    // ✅ Emit للـ room تبع المريض
    getIO().to(`patient-${patientId}`).emit('new-vital', vitals);

    let patientStatus: string | null = null;
    if (isCritical) {
      if (await escalatePatient(patient, alertType)) patientStatus = 'CRITICAL';
      await notifyCriticalVitals(patient, alertType, req.user?.id);
    }

    res.status(201).json({
      success: true,
      data: vitals,
      alert: isCritical ? { type: alertType, message: 'Critical vital detected!', patientStatus } : null,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Record vitals error:');
    res.status(500).json({ success: false, message: 'Failed to record vitals' });
  }
};

// GET /api/vitals - Get vitals
export const getVitals = async (req: Request, res: Response) => {
  try {
    const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined;
    const critical = req.query.critical;

    const where: Prisma.PatientVitalsWhereInput = { patient: { hospitalId: hospitalIdOf(req), deletedAt: null } };
    if (patientId) where.patientId = patientId;
    if (critical === 'true') where.isCritical = true;

    const page = pageParams(req.query, 50);
    const [vitals, totalCount] = await Promise.all([
      prisma.patientVitals.findMany({
        where,
        include: {
          patient: {
            select: { name: true, patientCode: true, department: true },
          },
        },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        skip: page.skip,
        take: page.take,
      }),
      prisma.patientVitals.count({ where }),
    ]);

    res.status(200).json({ success: true, count: vitals.length, data: vitals, pagination: pageInfo(page, totalCount) });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get vitals error:');
    res.status(500).json({ success: false, message: 'Failed to fetch vitals' });
  }
};

// GET /api/vitals/alerts - Get critical alerts
export const getCriticalAlerts = async (req: Request, res: Response) => {
  try {
    const department = req.query.department as string;

    const where: Prisma.PatientVitalsWhereInput = {
      isCritical: true,
      patient: { hospitalId: hospitalIdOf(req), deletedAt: null, ...(department ? { department } : {}) },
    };

    const alerts = await prisma.patientVitals.findMany({
      where,
      include: {
        patient: {
          select: { name: true, patientCode: true, department: true },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: 20,
    });

    res.status(200).json({ success: true, count: alerts.length, data: alerts });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get alerts error:');
    res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
  }
};

// GET /api/vitals/:id
export const getVitalsById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const vitals = await prisma.patientVitals.findFirst({
      where: { id, patient: { hospitalId: hospitalIdOf(req), deletedAt: null } },
      include: {
        patient: {
          select: { name: true, patientCode: true, department: true },
        },
      },
    });

    if (!vitals) {
      return res.status(404).json({ success: false, code: 'VITALS_NOT_FOUND', message: 'Vitals entry not found' });
    }

    res.status(200).json({ success: true, data: vitals });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get vitals by id error:');
    res.status(500).json({ success: false, message: 'Failed to fetch vitals' });
  }
};

// PUT /api/vitals/:id
export const updateVitals = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { values, invalid } = parseMetrics(body, true);
    if (invalid.length) return invalidMetricsResponse(res, invalid);
    const updateData: Record<string, unknown> = { ...values };
    if ('notes' in body) updateData.notes = body.notes;

    const currentVitals = await prisma.patientVitals.findFirst({
      where: { id, patient: { hospitalId: hospitalIdOf(req), deletedAt: null } },
      include: { patient: { include: { doctor: { select: { userId: true } } } } },
    });

    if (!currentVitals) {
      return res.status(404).json({ success: false, code: 'VITALS_NOT_FOUND', message: 'Vitals entry not found' });
    }

    const newVitalsData = mergeMetrics(values, currentVitals);

    const { isCritical, alertType } = await checkCriticalVitals(
      currentVitals.patient.hospitalId,
      currentVitals.patient.department,
      newVitalsData
    );

    const updated = await prisma.patientVitals.update({
      where: { id },
      data: {
        ...updateData,
        isCritical,
        alertType,
      },
    });

    // Only alert when the reading BECOMES critical (not on every edit of an already critical one).
    if (isCritical) await escalatePatient(currentVitals.patient, alertType);
    if (isCritical && !currentVitals.isCritical) {
      await notifyCriticalVitals(currentVitals.patient, alertType, req.user?.id);
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update vitals error:');
    res.status(500).json({ success: false, message: 'Failed to update vitals' });
  }
};

// DELETE /api/vitals/:id
export const deleteVitals = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const existing = await prisma.patientVitals.findFirst({
      where: { id, patient: { hospitalId: hospitalIdOf(req), deletedAt: null } },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ success: false, code: 'VITALS_NOT_FOUND', message: 'Vitals entry not found' });
    await prisma.patientVitals.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'Vitals entry deleted' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete vitals error:');
    res.status(500).json({ success: false, message: 'Failed to delete vitals' });
  }
};
// ─── Thresholds ────────────────────────────────────────────────────────

// GET /api/vitals/thresholds?department=ICU — with a department: the 6 rules that apply (own rows + defaults,
// each flagged with its `source`); without: every custom row of the hospital.
export const getThresholds = async (req: Request, res: Response) => {
  try {
    const hospitalId = hospitalIdOf(req);
    const department = typeof req.query.department === 'string' ? req.query.department : undefined;

    const data = department
      ? await loadEffectiveThresholds(hospitalId, department)
      : await prisma.vitalThresholds.findMany({ where: { hospitalId }, orderBy: [{ department: 'asc' }, { vitalType: 'asc' }] });

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get thresholds error:');
    res.status(500).json({ success: false, message: 'Failed to fetch thresholds' });
  }
};

// PUT /api/vitals/thresholds — create or update the rule of one (department, vitalType) of this hospital
export const upsertThreshold = async (req: Request, res: Response) => {
  try {
    const hospitalId = hospitalIdOf(req);
    const { department, vitalType, minNormal, maxNormal, minCritical, maxCritical, alertEnabled, autoNotify } = req.body;
    const limits = { minNormal, maxNormal, minCritical, maxCritical, alertEnabled, autoNotify };

    const threshold = await prisma.vitalThresholds.upsert({
      where: { hospitalId_department_vitalType: { hospitalId, department, vitalType } },
      update: limits,
      create: { hospitalId, department, vitalType, ...limits },
    });

    res.status(200).json({ success: true, data: threshold });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Upsert threshold error:');
    res.status(500).json({ success: false, message: 'Failed to save threshold' });
  }
};

// DELETE /api/vitals/thresholds/:id — drop the custom rule; the built-in default applies again
export const deleteThreshold = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { count } = await prisma.vitalThresholds.deleteMany({ where: { id, hospitalId: hospitalIdOf(req) } });
    if (count === 0) return res.status(404).json({ success: false, code: 'THRESHOLD_NOT_FOUND', message: 'Threshold not found' });
    res.status(200).json({ success: true, message: 'Threshold removed; the default applies' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete threshold error:');
    res.status(500).json({ success: false, message: 'Failed to delete threshold' });
  }
};
