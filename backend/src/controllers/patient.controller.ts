// backend/src/controllers/patient.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { BedRuleError, claimBed, releaseBed } from '../services/bedAssignment';
import { randomUUID } from 'crypto';
import type { Bed, PatientStatus, Prisma } from '@prisma/client';

type BedWithWard = Bed & { ward: { id: string; name: string } };

const PATIENT_CODE_BASE = 2040;
const MAX_CODE_ATTEMPTS = 10;

const isPatientCodeConflict = (error: unknown): boolean => {
  const e = error as { code?: string; meta?: { target?: unknown } };
  return e?.code === 'P2002' && String(e.meta?.target ?? 'patientCode').includes('patientCode');
};

// Next free number: above both the row count and the highest existing PT-<n>,
// so deleted or seeded rows can't make the count-based guess collide.
const nextPatientNumber = async (): Promise<number> => {
  const count = await prisma.patient.count();
  const agg = await prisma.patient.aggregate({
    _max: { patientCode: true },
    where: { patientCode: { startsWith: 'PT-' } },
  });
  const highest = Number(agg?._max?.patientCode?.slice(3));
  return Math.max(PATIENT_CODE_BASE + count, Number.isFinite(highest) ? highest : 0) + 1;
};

// ============================================
// GET /api/patients/recent
// ============================================
export const getRecentPatients = async (req: Request, res: Response) => {
  try {
    const recentPatients = await prisma.patient.findMany({
      where: { hospitalId: hospitalIdOf(req) },
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
    const count = await prisma.patient.count({ where: { status: 'CRITICAL', hospitalId: hospitalIdOf(req) } });
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
const DAY_MS = 24 * 60 * 60 * 1000;
const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

export const getPatientFlow = async (req: Request, res: Response) => {
  try {
    const days = Number((req.query as { days?: number }).days ?? 7);
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * DAY_MS);

    const rows = await prisma.patient.findMany({
      where: {
        hospitalId: hospitalIdOf(req),
        OR: [{ admissionDate: { gte: start } }, { dischargeDate: { gte: start } }],
      },
      select: { admissionDate: true, dischargeDate: true },
    });

    const buckets = new Map<string, { date: string; admissions: number; discharges: number }>();
    for (let i = 0; i < days; i++) {
      const date = utcDay(new Date(start.getTime() + i * DAY_MS));
      buckets.set(date, { date, admissions: 0, discharges: 0 });
    }
    for (const r of rows) {
      const a = buckets.get(utcDay(r.admissionDate));
      if (a) a.admissions += 1;
      const d = r.dischargeDate ? buckets.get(utcDay(r.dischargeDate)) : undefined;
      if (d) d.discharges += 1;
    }

    res.status(200).json({ success: true, data: Array.from(buckets.values()) });
  } catch (error) {
    logger.error({ err: error }, 'getPatientFlow error:');
    res.status(500).json({ success: false, message: 'Failed to fetch patient flow' });
  }
};

// ============================================
// POST /api/patients/admit
// ============================================
// Business-rule failure inside the admit transaction: safe to show to the client.
class AdmitError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}


export const admitPatient = async (req: Request, res: Response) => {
  // hospitalId is never read from the body: the patient joins the admitting user's hospital.
  const { name, age, gender, department, diagnosis, bedId, doctorId } = req.body;

  try {
    const hospitalId = hospitalIdOf(req);

    const firstNumber = await nextPatientNumber();

    let result;
    for (let attempt = 0; ; attempt++) {
      const patientCode = `PT-${firstNumber + attempt}`;
      try {
        result = await prisma.$transaction(async (tx) => {
          let validBedId = null;

          if (doctorId) {
            const doctor = await tx.user.findFirst({ where: { id: doctorId, hospitalId }, select: { id: true } });
            if (!doctor) throw new AdmitError('Doctor not found', 404);
          }

          if (bedId) {
            // Atomic: only a free AVAILABLE bed can be claimed (404 / 409 otherwise).
            await claimBed(tx, bedId, hospitalId);
            validBedId = bedId;
          }

          const patientData: Prisma.PatientUncheckedCreateInput = {
            patientCode,
            name,
            age: parseInt(age),
            gender,
            department,
            diagnosis,
            status: 'OBSERVATION',
            hospitalId,
          };

          if (validBedId) patientData.bedId = validBedId;
          if (doctorId) patientData.doctorId = doctorId;

          const newPatient = await tx.patient.create({ data: patientData });

          return newPatient;
        });
        break;
      } catch (error) {
        // Concurrent admits can pick the same number; the unique index rejects one, so retry with the next.
        if (isPatientCodeConflict(error) && attempt < MAX_CODE_ATTEMPTS - 1) continue;
        throw error;
      }
    }

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

    const patient = await prisma.patient.findFirst({ where: { id: patientId, hospitalId: hospitalIdOf(req) } });
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
    const report = await prisma.report.findFirst({ where: { id: reportId, patient: { hospitalId: hospitalIdOf(req) } } });
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
      where: { patientId: id, patient: { hospitalId: hospitalIdOf(req) } },
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
      where: { id, hospitalId: hospitalIdOf(req) },
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
    const { status, department, search, page = '1', limit = '10' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 10));
    const skip = (pageNum - 1) * limitNum;

    const whereClause: Prisma.PatientWhereInput = { hospitalId: hospitalIdOf(req) };

    if (status && status !== 'undefined' && status !== 'ALL' && status !== '' && status !== 'All') {
      whereClause.status = (status as string).toUpperCase() as PatientStatus;
    }

    if (department && department !== 'undefined' && department !== 'ALL' && department !== '' && department !== 'All') {
      whereClause.department = department as string;
    }

    if (search && search !== 'undefined' && search !== '') {
      whereClause.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { patientCode: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [patients, totalCount] = await Promise.all([
      prisma.patient.findMany({
        where: whereClause,
        skip,
        take: limitNum,
        orderBy: { admissionDate: 'desc' },
        select: {
          id: true,
          patientCode: true,
          name: true,
          age: true,
          gender: true,
          department: true,
          diagnosis: true,
          status: true,
          admissionDate: true,
          dischargeDate: true,
          bedId: true,
          bed: {
            select: {
              bedNumber: true,
              ward: { select: { name: true } },
            },
          },
        },
      }),
      prisma.patient.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({ 
      success: true, 
      data: patients,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      }
    });
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
    const { bedId: requestedBedId, ...fields } = req.body as Omit<Prisma.PatientUncheckedUpdateInput, 'bedId'> & {
      bedId?: string | null;
      doctorId?: string | null;
      status?: PatientStatus;
    };
    const hospitalId = hospitalIdOf(req);

    const existing = await prisma.patient.findFirst({ where: { id, hospitalId }, select: { id: true, bedId: true, status: true } });
    if (!existing) {
      return res.status(404).json({ success: false, code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
    }
    if (fields.doctorId && !(await prisma.user.findFirst({ where: { id: fields.doctorId, hospitalId }, select: { id: true } }))) {
      return res.status(404).json({ success: false, code: 'DOCTOR_NOT_FOUND', message: 'Doctor not found' });
    }

    // Bed rules (OCCUPIED <=> has a patient): a DISCHARGED patient holds no bed and cannot be given one.
    const discharging = (fields.status ?? existing.status) === 'DISCHARGED';
    if (discharging && requestedBedId) {
      return res.status(400).json({ success: false, message: 'A discharged patient cannot be assigned a bed' });
    }
    // The bed the patient ends up in: discharge frees it, an explicit bedId (or null) replaces it, otherwise unchanged.
    const targetBedId = discharging ? null : requestedBedId === undefined ? existing.bedId : requestedBedId;
    const bedChanges = targetBedId !== existing.bedId;
    const justDischarged = discharging && existing.status !== 'DISCHARGED';

    const updated = await prisma.$transaction(async (tx) => {
      if (bedChanges) {
        if (targetBedId) await claimBed(tx, targetBedId, hospitalId);
        if (existing.bedId) await releaseBed(tx, existing.bedId, hospitalId);
      }
      return tx.patient.update({
        where: { id },
        data: {
          ...fields,
          ...(bedChanges ? { bedId: targetBedId } : {}),
          ...(justDischarged && !fields.dischargeDate ? { dischargeDate: new Date() } : {}),
        },
        include: { bed: true },
      });
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error: unknown) {
    if (error instanceof BedRuleError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    logger.error({ err: error }, 'Update patient error:');
    res.status(500).json({ success: false, message: 'Failed to update patient' });
  }
};

// ============================================
// PUT /api/patients/:id/discharge
// ============================================
export const dischargePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const hospitalId = hospitalIdOf(req);
    const patient = await prisma.patient.findFirst({
      where: { id, hospitalId },
      include: { bed: true }
    });

    if (!patient) {
      return res.status(404).json({ success: false, code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (patient.bedId) await releaseBed(tx, patient.bedId, hospitalId);

      const updated = await tx.patient.update({
        where: { id },
        data: {
          status: 'DISCHARGED',
          dischargeDate: new Date(),
          bedId: null
        }
      });

      return updated;
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Discharge patient error:');
    res.status(500).json({ success: false, message: 'Failed to discharge patient' });
  }
};