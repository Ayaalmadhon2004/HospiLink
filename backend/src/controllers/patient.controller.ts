// backend/src/controllers/patient.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { BedRuleError } from '../services/bedAssignment';
import { randomUUID } from 'crypto';
import type { Bed } from '@prisma/client';
import { AdmitError, admitPatientTx, dischargePatientRecord, softDeletePatient, updatePatientRecord, type AdmitInput, type PatientUpdateInput } from '../services/patientAdmission';
import { getPatientFlowData, listPatients } from '../services/patientQueries';

type BedWithWard = Bed & { ward: { id: string; name: string } };

// ============================================
// GET /api/patients/recent
// ============================================
export const getRecentPatients = async (req: Request, res: Response) => {
  try {
    const recentPatients = await prisma.patient.findMany({
      where: { hospitalId: hospitalIdOf(req), deletedAt: null },
      take: 5,
      orderBy: { admissionDate: 'desc' },
      include: { bed: true },
    });

    res.status(200).json({ 
      success: true, 
      count: recentPatients.length,
      data: recentPatients 
    });

  } catch (error: unknown) {
    logger.error({ err: error }, "🔥 getRecentPatients error:");
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recent patients' });
  }
};

// ============================================
// GET /api/patients/critical-count
// عدد المرضى بحالة CRITICAL (للـ badge في الـ Sidebar)
// ============================================
export const getCriticalPatientCount = async (req: Request, res: Response) => {
  try {
    const count = await prisma.patient.count({ where: { status: 'CRITICAL', hospitalId: hospitalIdOf(req), deletedAt: null } });
    res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    logger.error({ err: error }, 'getCriticalPatientCount error:');
    res.status(500).json({ success: false, message: 'Failed to fetch critical patients count' });
  }
};

// ============================================
// GET /api/patients/flow?days=7
// Daily admissions and discharges (UTC days, today included), oldest first
// ============================================
export const getPatientFlow = async (req: Request, res: Response) => {
  try {
    const days = Number((req.query as { days?: number }).days ?? 7);
    const data = await getPatientFlowData(hospitalIdOf(req), days);
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, 'getPatientFlow error:');
    res.status(500).json({ success: false, message: 'Failed to fetch patient flow' });
  }
};

// ============================================
// POST /api/patients/admit
// ============================================
export const admitPatient = async (req: Request, res: Response) => {
  // hospitalId is never read from the body: the patient joins the admitting user's hospital.
  const input = req.body as AdmitInput;

  try {
    const result = await admitPatientTx(input, hospitalIdOf(req));
    res.status(201).json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof AdmitError || error instanceof BedRuleError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    logger.error({ err: error }, '🔥 Admit error:');
    res.status(500).json({
      success: false,
      message: 'Failed to admit patient' });
  }
};
// ============================================
// POST /api/patients/:id/reports
// ============================================
export const uploadReport = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const patientId = req.params.id as string;
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }

    const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId: hospitalIdOf(req), deletedAt: null } });
    if (!patient) {
      return res.status(404).json({ success: false, code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
    }

    const reportId = randomUUID();
    const created = await prisma.report.create({
      data: {
        id: reportId,
        fileName: req.file.originalname,
        // Served by getReportFile; the frontend prefixes the API origin.
        fileUrl: `/api/patients/reports/${reportId}/file`,
        fileType: req.file.mimetype,
        fileData: new Uint8Array(req.file.buffer),
        patientId: patientId,
        uploadedBy: req.user?.id, // set by protect(); the old `userId` claim was never set, so this was always empty
      },
    });
    const { fileData: _fileData, ...report } = created;

    res.status(201).json({ success: true, message: 'Report uploaded', data: report });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Upload error:');
    res.status(500).json({ success: false, message: 'Failed to upload report' });
  }
};

// ============================================
// GET /api/patients/reports/:reportId/file
// ============================================
export const getReportFile = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params as { reportId: string };
    const report = await prisma.report.findFirst({ where: { id: reportId, patient: { hospitalId: hospitalIdOf(req), deletedAt: null } } });
    if (!report || !report.fileData) {
      return res.status(404).json({ success: false, code: 'FILE_NOT_FOUND', message: 'File not found' });
    }

    res.setHeader('Content-Type', report.fileType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; object-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'");
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(Buffer.from(report.fileData));
  } catch (error) {
    logger.error({ err: error }, 'Report file error:');
    res.status(500).json({ success: false, message: 'Failed to fetch file' });
  }
};

// ============================================
// GET /api/patients/:id/reports
// ============================================
export const getPatientReports = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const reports = await prisma.report.findMany({
      where: { patientId: id, patient: { hospitalId: hospitalIdOf(req), deletedAt: null } },
      omit: { fileData: true },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get reports error:');
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
    });
  }
};

// ============================================
// GET /api/patients/:id
// ============================================
export const getPatientById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId: hospitalIdOf(req), deletedAt: null },
      include: {
        bed: { 
          select: { 
            bedNumber: true,
            ward: { select: { name: true } }
          } 
        },
      }
    });

    if (!patient) {
      return res.status(404).json({ success: false, code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
    }

    res.status(200).json({ success: true, data: patient });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get patient error:');
    res.status(500).json({ success: false, message: 'Failed to fetch patient' });
  }
};

// ============================================
// GET /api/patients
// ============================================
export const getPatients = async (req: Request, res: Response) => {
  try {
    const { patients, pagination } = await listPatients(hospitalIdOf(req), req.query);
    res.status(200).json({ success: true, data: patients, pagination });
  } catch (error: unknown) {
    logger.error({ err: error }, "🔥 Error:");
    res.status(500).json({ success: false, message: 'Failed to fetch patients' });
  }
};

// ============================================
// GET /api/patients/beds/available
// ============================================
export const getAvailableBeds = async (req: Request, res: Response) => {
  try {
    const { department } = req.query as { department?: string };
    // Wards are the only department-like grouping on a bed, so `department` matches the ward name.
    const beds: BedWithWard[] = await prisma.bed.findMany({
      where: {
        status: 'AVAILABLE',
        hospitalId: hospitalIdOf(req),
        ...(department ? { ward: { name: { equals: department, mode: 'insensitive' } } } : {}),
      },
      include: { ward: { select: { id: true, name: true } } },
      orderBy: { bedNumber: 'asc' },
    });

    const groupedByWard = beds.reduce<Record<string, BedWithWard[]>>((acc, bed) => {
      (acc[bed.ward.name] ??= []).push(bed);
      return acc;
    }, {});

    res.status(200).json({ success: true, count: beds.length, data: beds, groupedByWard });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get available beds error:');
    res.status(500).json({ success: false, message: 'Failed to fetch available beds' });
  }
};

// ============================================
// PUT /api/patients/:id
// ============================================
export const updatePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { bedId: requestedBedId, ...fields } = req.body as PatientUpdateInput['fields'] & { bedId?: string | null };

    const outcome = await updatePatientRecord(id, hospitalIdOf(req), { fields, requestedBedId });
    switch (outcome.kind) {
      case 'not-found':
        return res.status(404).json({ success: false, code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
      case 'doctor-not-found':
        return res.status(404).json({ success: false, code: 'DOCTOR_NOT_FOUND', message: 'Doctor not found' });
      case 'discharged-with-bed':
        return res.status(400).json({ success: false, message: 'A discharged patient cannot be assigned a bed' });
      case 'ok':
        return res.status(200).json({ success: true, data: outcome.patient });
    }
  } catch (error: unknown) {
    if (error instanceof BedRuleError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    logger.error({ err: error }, 'Update patient error:');
    res.status(500).json({ success: false, message: 'Failed to update patient' });
  }
};

// ============================================
// DELETE /api/patients/:id  (soft delete)
// ============================================
// The row, its vitals, reports and appointments stay in the database (medical history is never destroyed);
// the patient just disappears from every read (they all filter deletedAt: null). A held bed is freed.
export const deletePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    if (!(await softDeletePatient(id, hospitalIdOf(req)))) {
      return res.status(404).json({ success: false, code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
    }
    res.status(200).json({ success: true, message: 'Patient deleted' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete patient error:');
    res.status(500).json({ success: false, message: 'Failed to delete patient' });
  }
};

// ============================================
// PUT /api/patients/:id/discharge
// ============================================
export const dischargePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const result = await dischargePatientRecord(id, hospitalIdOf(req));
    if (!result) {
      return res.status(404).json({ success: false, code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
    }
    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Discharge patient error:');
    res.status(500).json({ success: false, message: 'Failed to discharge patient' });
  }
};
