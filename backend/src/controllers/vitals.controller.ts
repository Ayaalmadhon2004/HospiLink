// backend/src/controllers/vitals.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import { io } from '../server';

export const createVital = async (req: Request, res: Response) => {
  try {
    const { patientId, heartRate, systolicBP, spO2, temperature, respiratoryRate } = req.body;
    
    const newVital = await prisma.patientVitals.create({
      data: {
        patientId: patientId as string,
        heartRate: Number(heartRate),
        systolicBP: Number(systolicBP),
        spO2: Number(spO2),
        temperature: Number(temperature),
        respiratoryRate: Number(respiratoryRate),
      } as any
    });
    
    io.to(`patient-${newVital.patientId}`).emit('new-vital', newVital);
    
    res.status(201).json({ success: true, data: newVital });
  } catch (error) {
    console.error('Create vital error:', error);
    res.status(500).json({ success: false, message: 'فشل حفظ البيانات' });
  }
};

// Helper: Check if vitals are critical
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
      }[t.vitalType as keyof typeof vitals];

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
  } catch (e) {
    console.log('Thresholds check skipped:', e);
    return { isCritical: false, alertType: null };
  }
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

    const patient = await prisma.patient.findUnique({
      where: { id: patientId as string },
      select: { department: true },
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const { isCritical, alertType } = await checkCriticalVitals(patient.department, {
      heartRate: Number(heartRate),
      systolicBP: Number(systolicBP),
      diastolicBP: Number(diastolicBP),
      spO2: Number(spO2),
      temperature: Number(temperature),
      respiratoryRate: Number(respiratoryRate),
    });

    const vitals = await (prisma as any).patientVitals.create({
      data: {
        patientId: patientId as string,
        heartRate: Number(heartRate),
        systolicBP: Number(systolicBP),
        diastolicBP: Number(diastolicBP),
        spO2: Number(spO2),
        temperature: Number(temperature),
        respiratoryRate: Number(respiratoryRate),
        recordedBy: (req.user as any)?.userId || 'system',
        notes,
        isCritical,
        alertType,
      } as any,
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

// GET /api/vitals - Get vitals
export const getVitals = async (req: Request, res: Response) => {
  try {
    const patientId = req.query.patientId as string;
    const critical = req.query.critical as string;
    const limit = req.query.limit as string;

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
      take: parseInt(limit || '50'),
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
    console.error('Get alerts error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch alerts', error: error.message });
  }
};

// GET /api/vitals/:id
export const getVitalsById = async (req: Request, res: Response) => {
  try {
const { id } = req.params as { id: string }
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
    console.error('Get vitals by id error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch vitals', error: error.message });
  }
};

// PUT /api/vitals/:id
export const updateVitals = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const updateData = req.body;

    const currentVitals = await (prisma as any).patientVitals.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!currentVitals) {
      return res.status(404).json({ success: false, message: 'Vitals entry not found' });
    }

    const newVitalsData = { ...currentVitals, ...updateData };

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
    console.error('Update vitals error:', error);
    res.status(500).json({ success: false, message: 'Failed to update vitals', error: error.message });
  }
};

// DELETE /api/vitals/:id
export const deleteVitals = async (req: Request, res: Response) => {
  try {
const { id } = req.params as { id: string }
    await (prisma as any).patientVitals.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'Vitals entry deleted' });
  } catch (error: any) {
    console.error('Delete vitals error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete vitals', error: error.message });
  }
};