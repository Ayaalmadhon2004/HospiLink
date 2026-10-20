// backend/src/controllers/vitals.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { io } from '../server';
import logger from '../config/logger';

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

export const createVital = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.body;
    const { values, invalid } = parseMetrics(req.body);
    if (invalid.length) return invalidMetricsResponse(res, invalid);

    const newVital = await prisma.patientVitals.create({
      data: {
        patientId: patientId as string,
        heartRate: values.heartRate,
        systolicBP: values.systolicBP,
        spO2: values.spO2,
        temperature: values.temperature,
        respiratoryRate: values.respiratoryRate,
      } as any,
    });

    io.to(`patient-${newVital.patientId}`).emit('new-vital', newVital);

    res.status(201).json({ success: true, data: newVital });
  } catch (error) {
    logger.error({ err: error }, 'Create vital error:');
    res.status(500).json({ success: false, message: 'فشل حفظ البيانات' });
  }
};

// Helper: Check if vitals are critical
const checkCriticalVitals = async (
  department: string,
  vitals: MetricValues
): Promise<{ isCritical: boolean; alertType: string | null }> => {
  try {
    const thresholds = await (prisma as any).vitalThresholds.findMany({
      where: { department, alertEnabled: true },
    });

    let isCritical = false;
    let alertType: string | null = null;

    for (const t of thresholds) {
      const value = {
        HEART_RATE: vitals.heartRate,
        BP_SYSTOLIC: vitals.systolicBP,
        BP_DIASTOLIC: vitals.diastolicBP,
        SPO2: vitals.spO2,
        TEMPERATURE: vitals.temperature,
        RESPIRATORY_RATE: vitals.respiratoryRate,
      }[t.vitalType as string];

      // Missing/invalid metric: skip its threshold (never compare against NaN/null).
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;

      if (t.minCritical !== null && value < t.minCritical) {
        isCritical = true;
        alertType = `${t.vitalType}_LOW`;
        break;
      }
      if (t.maxCritical !== null && value > t.maxCritical) {
        isCritical = true;
        alertType = `${t.vitalType}_HIGH`;
        break;
      }
    }

    return { isCritical, alertType };
  } catch (e) {
    logger.debug({ err: e }, 'Thresholds check skipped');
    return { isCritical: false, alertType: null };
  }
};

// POST /api/vitals - Record new vitals
export const recordVitals = async (req: Request, res: Response) => {
  try {
    const { patientId, notes } = req.body;
    const { values, invalid } = parseMetrics(req.body);
    if (invalid.length) return invalidMetricsResponse(res, invalid);

    const patient = await prisma.patient.findUnique({
      where: { id: patientId as string },
      select: { department: true },
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const { isCritical, alertType } = await checkCriticalVitals(patient.department, values);

    const vitals = await (prisma as any).patientVitals.create({
      data: {
        patientId: patientId as string,
        heartRate: values.heartRate,
        systolicBP: values.systolicBP,
        diastolicBP: values.diastolicBP,
        spO2: values.spO2,
        temperature: values.temperature,
        respiratoryRate: values.respiratoryRate,
        recordedBy: (req.user as any)?.userId || 'system',
        notes,
        isCritical,
        alertType,
      } as any,
    });

    // ✅ Emit للـ room تبع المريض
    io.to(`patient-${patientId}`).emit('new-vital', vitals);

    res.status(201).json({
      success: true,
      data: vitals,
      alert: isCritical ? { type: alertType, message: 'Critical vital detected!' } : null,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Record vitals error:');
    res.status(500).json({ success: false, message: 'Failed to record vitals', error: error.message });
  }
};

// GET /api/vitals - Get vitals
export const getVitals = async (req: Request, res: Response) => {
  try {
    const patientId = typeof req.query.patientId === 'string' ? req.query.patientId : undefined;
    const critical = req.query.critical;

    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (critical === 'true') where.isCritical = true;

    const vitals = await (prisma as any).patientVitals.findMany({
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
  } catch (error: any) {
    logger.error({ err: error }, 'Get vitals error:');
    res.status(500).json({ success: false, message: 'Failed to fetch vitals', error: error.message });
  }
};

// GET /api/vitals/alerts - Get critical alerts
export const getCriticalAlerts = async (req: Request, res: Response) => {
  try {
    const department = req.query.department as string;

    const where: any = { isCritical: true };
    if (department) where.patient = { department };

    const alerts = await (prisma as any).patientVitals.findMany({
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
  } catch (error: any) {
    logger.error({ err: error }, 'Get alerts error:');
    res.status(500).json({ success: false, message: 'Failed to fetch alerts', error: error.message });
  }
};

// GET /api/vitals/:id
export const getVitalsById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const vitals = await (prisma as any).patientVitals.findUnique({
      where: { id },
      include: {
        patient: {
          select: { name: true, patientCode: true, department: true },
        },
      },
    });

    if (!vitals) {
      return res.status(404).json({ success: false, message: 'Vitals entry not found' });
    }

    res.status(200).json({ success: true, data: vitals });
  } catch (error: any) {
    logger.error({ err: error }, 'Get vitals by id error:');
    res.status(500).json({ success: false, message: 'Failed to fetch vitals', error: error.message });
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

    const currentVitals = await (prisma as any).patientVitals.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!currentVitals) {
      return res.status(404).json({ success: false, message: 'Vitals entry not found' });
    }

    const newVitalsData: MetricValues = {};
    for (const key of METRIC_KEYS) {
      const next = key in values ? values[key] : currentVitals[key];
      newVitalsData[key] = typeof next === 'number' && Number.isFinite(next) ? next : null;
    }

    const { isCritical, alertType } = await checkCriticalVitals(
      currentVitals.patient.department,
      newVitalsData
    );

    const updated = await (prisma as any).patientVitals.update({
      where: { id },
      data: {
        ...updateData,
        isCritical,
        alertType,
      },
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    logger.error({ err: error }, 'Update vitals error:');
    res.status(500).json({ success: false, message: 'Failed to update vitals', error: error.message });
  }
};

// DELETE /api/vitals/:id
export const deleteVitals = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    await (prisma as any).patientVitals.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'Vitals entry deleted' });
  } catch (error: any) {
    logger.error({ err: error }, 'Delete vitals error:');
    res.status(500).json({ success: false, message: 'Failed to delete vitals', error: error.message });
  }
};