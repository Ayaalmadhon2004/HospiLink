// backend/src/controllers/vitals.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { getIO } from '../utils/socket';
import logger from '../config/logger';
import { hospitalIdOf, clinicalRoom } from '../utils/tenant';
import { loadEffectiveThresholds, evaluateReading } from '../services/vitalThresholds';
import { notify } from '../services/notification.service';
import type { Prisma } from '@prisma/client';

const METRIC_KEYS = [
  'heartRate',
  'systolicBP',
  'diastolicBP',
  'spO2',
  'temperature',
  'respiratoryRate',
] as const;
type MetricKey = (typeof METRIC_KEYS)[number];
type MetricValues = Partial<Record<MetricKey, number | null>>;

// undefined/null/'' => null (missing); numeric value/string => finite number; anything else => undefined (invalid).
// `protect` always sets req.user on routed requests; the fallback only covers a call without an authenticated user.
const SYSTEM_RECORDER = 'system';

const parseMetric = (v: unknown): number | null | undefined => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  return undefined;
};

// Reads the metric keys of `body`. Never yields NaN: bad values are listed in `invalid`.
const parseMetrics = (body: Record<string, unknown>, onlyPresent = false) => {
  const values: MetricValues = {};
  const invalid: string[] = [];
  for (const key of METRIC_KEYS) {
    if (onlyPresent && !(key in body)) continue;
    const parsed = parseMetric(body[key]);
    if (parsed === undefined) invalid.push(key);
    else values[key] = parsed;
  }
  return { values, invalid };
};

const invalidMetricsResponse = (res: Response, invalid: string[]) =>
  res.status(400).json({ success: false, message: `Invalid numeric value for: ${invalid.join(', ')}` });

// Safe query parsing: positive integer with default, clamped to max.
const parseLimit = (raw: unknown, def = 50, max = 200): number => {
  if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) return def;
  const n = parseInt(raw.trim(), 10);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, max) : def;
};

// Judges a reading against the thresholds of the patient's department (own rows + built-in defaults).
const checkCriticalVitals = async (
  hospitalId: string,
  department: string,
  vitals: MetricValues
): Promise<{ isCritical: boolean; alertType: string | null }> =>
  evaluateReading(vitals, await loadEffectiveThresholds(hospitalId, department));

// A critical reading escalates the patient to CRITICAL. It never downgrades (a clinician does that) and never
// touches a DISCHARGED patient. Returns true when the status actually changed.
const escalatePatient = async (patient: { id: string; hospitalId: string }, alertType: string | null): Promise<boolean> => {
  try {
    const { count } = await prisma.patient.updateMany({
      where: { id: patient.id, hospitalId: patient.hospitalId, status: { notIn: ['CRITICAL', 'DISCHARGED'] } },
      data: { status: 'CRITICAL' },
    });
    if (count === 0) return false;
    const payload = { patientId: patient.id, status: 'CRITICAL', reason: alertType, timestamp: new Date() };
    getIO().to(`patient-${patient.id}`).emit('patient-status-changed', payload);
    getIO().to(clinicalRoom(patient.hospitalId)).emit('patient-status-changed', payload);
    return true;
  } catch (err) {
    // The reading is already saved and the alert goes out: do not fail the request, but make the failure visible.
    logger.error({ err, patientId: patient.id }, 'Could not escalate the patient to CRITICAL');
    return false;
  }
};

// Critical vitals go to the assigned doctor plus doctors/nurses of the patient's department.
const notifyCriticalVitals = (
  patient: { id: string; name?: string | null; department: string; doctorId?: string | null; hospitalId: string },
  alertType: string | null,
  actorId?: string
) =>
  notify({
    type: 'VITALS',
    title: 'Critical vitals alert',
    message: `${patient.name ?? 'Patient'} (${patient.department}): ${alertType ?? 'critical reading'}`,
    link: `/patients/${patient.id}`,
    recipients: {
      roles: ['DOCTOR', 'NURSE'],
      department: patient.department,
      userIds: patient.doctorId ? [patient.doctorId] : [],
      hospitalId: patient.hospitalId,
      scopeUserId: actorId,
    },
  });

// POST /api/vitals - Record new vitals
export const recordVitals = async (req: Request, res: Response) => {
  try {
    const { patientId, notes } = req.body;
    const { values, invalid } = parseMetrics(req.body);
    if (invalid.length) return invalidMetricsResponse(res, invalid);

    const patient = await prisma.patient.findFirst({
      where: { id: patientId as string, hospitalId: hospitalIdOf(req) },
      select: { id: true, name: true, department: true, doctorId: true, hospitalId: true },
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

    const where: Prisma.PatientVitalsWhereInput = { patient: { hospitalId: hospitalIdOf(req) } };
    if (patientId) where.patientId = patientId;
    if (critical === 'true') where.isCritical = true;

    const vitals = await prisma.patientVitals.findMany({
      where,
      include: {
        patient: {
          select: { name: true, patientCode: true, department: true },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: parseLimit(req.query.limit),
    });

    res.status(200).json({ success: true, count: vitals.length, data: vitals });
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
      patient: { hospitalId: hospitalIdOf(req), ...(department ? { department } : {}) },
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
      where: { id, patient: { hospitalId: hospitalIdOf(req) } },
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
      where: { id, patient: { hospitalId: hospitalIdOf(req) } },
      include: { patient: true },
    });

    if (!currentVitals) {
      return res.status(404).json({ success: false, code: 'VITALS_NOT_FOUND', message: 'Vitals entry not found' });
    }

    const newVitalsData: MetricValues = {};
    for (const key of METRIC_KEYS) {
      const next = key in values ? values[key] : currentVitals[key];
      newVitalsData[key] = typeof next === 'number' && Number.isFinite(next) ? next : null;
    }

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
      where: { id, patient: { hospitalId: hospitalIdOf(req) } },
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
