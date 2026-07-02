import { Request, Response } from 'express';
import prisma from '../config/db';

// Helper: Check if vitals are critical based on thresholds
const checkCriticalVitals = async (
  department: string,
  vitals: {
    heartRate?: number;
    systolicBP?: number;
    diastolicBP?: number;
    spO2?: number;
    temperature?: number;
    respiratoryRate?: number;
  }
): Promise<{ isCritical: boolean; alertType: string | null }> => {
  const thresholds = await prisma.vitalThresholds.findMany({
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
    }[t.vitalType];

    if (value === undefined || value === null) continue;

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
};

// POST /api/vitals - Record new vitals
export const recordVitals = async (req: Request, res: Response) => {
  try {
    const {
      patientId,
      heartRate,
      systolicBP,
      diastolicBP,
      spO2,
      temperature,
      respiratoryRate,
      notes,
    } = req.body;

    // Get patient department for threshold check
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { department: true },
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Check if critical
    const { isCritical, alertType } = await checkCriticalVitals(patient.department, {
      heartRate,
      systolicBP,
      diastolicBP,
      spO2,
      temperature,
      respiratoryRate,
    });

    const vitals = await prisma.patientVitals.create({
      data: {
        patientId,
        heartRate,
        systolicBP,
        diastolicBP,
        spO2,
        temperature,
        respiratoryRate,
        recordedBy: (req.user as any)?.userId,
        notes,
        isCritical,
        alertType,
      },
    });

    res.status(201).json({
      success: true,
      data: vitals,
      alert: isCritical ? { type: alertType, message: 'Critical vital detected!' } : null,
    });
  } catch (error: any) {
    console.error('Record vitals error:', error);
    res.status(500).json({ success: false, message: 'Failed to record vitals', error: error.message });
  }
};

// GET /api/vitals - Get vitals (with filters)
export const getVitals = async (req: Request, res: Response) => {
  try {
    const { patientId, critical, limit = '50' } = req.query;

    const where: any = {};
    if (patientId) where.patientId = patientId as string;
    if (critical === 'true') where.isCritical = true;

    const vitals = await prisma.patientVitals.findMany({
      where,
      include: {
        patient: {
          select: { name: true, patientCode: true, department: true },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.status(200).json({ success: true, count: vitals.length, data: vitals });
  } catch (error: any) {
    console.error('Get vitals error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vitals', error: error.message });
  }
};

// GET /api/vitals/alerts - Get critical alerts
export const getCriticalAlerts = async (req: Request, res: Response) => {
  try {
    const { department } = req.query;

    const where: any = { isCritical: true };
    if (department) where.patient = { department: department as string };

    const alerts = await prisma.patientVitals.findMany({
      where,
      include: {
        patient: {
          select: { name: true, patientCode: true, department: true, bed: true },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: 20,
    });

    res.status(200).json({ success: true, count: alerts.length, data: alerts });
  } catch (error: any) {
    console.error('Get alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alerts', error: error.message });
  }
};

// GET /api/vitals/:id - Get single vitals entry
export const getVitalsById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const vitals = await prisma.patientVitals.findUnique({
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
    console.error('Get vitals by id error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vitals', error: error.message });
  }
};

// PUT /api/vitals/:id - Update vitals entry
export const updateVitals = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const vitals = await prisma.patientVitals.update({
      where: { id },
      data: updateData,
    });

    res.status(200).json({ success: true, data: vitals });
  } catch (error: any) {
    console.error('Update vitals error:', error);
    res.status(500).json({ success: false, message: 'Failed to update vitals', error: error.message });
  }
};

// DELETE /api/vitals/:id - Delete vitals entry
export const deleteVitals = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.patientVitals.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'Vitals entry deleted' });
  } catch (error: any) {
    console.error('Delete vitals error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete vitals', error: error.message });
  }
};