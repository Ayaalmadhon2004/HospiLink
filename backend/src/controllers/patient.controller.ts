// backend/src/controllers/patient.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';
import { randomUUID } from 'crypto';

// ============================================
// GET /api/patients/recent
// ============================================
export const getRecentPatients = async (req: Request, res: Response) => {
  try {
    if (!prisma) {
      throw new Error("Prisma client is not initialized");
    }

    const recentPatients = await prisma.patient.findMany({
      take: 5,           
      orderBy: { admissionDate: 'desc' },
      include: { bed: true },
    });

    res.status(200).json({ 
      success: true, 
      count: recentPatients.length,
      data: recentPatients 
    });

  } catch (error: any) {
    logger.error({ err: error }, "🔥 getRecentPatients error:");
    res.status(500).json({ 
      success: false, 
      message: 'فشل جلب قائمة المرضى' });
  }
};

// ============================================
// GET /api/patients/critical-count
// عدد المرضى بحالة CRITICAL (للـ badge في الـ Sidebar)
// ============================================
export const getCriticalPatientCount = async (_req: Request, res: Response) => {
  try {
    const count = await prisma.patient.count({ where: { status: 'CRITICAL' } });
    res.status(200).json({ success: true, data: { count } });
  } catch (error) {
    logger.error({ err: error }, 'getCriticalPatientCount error:');
    res.status(500).json({ success: false, message: 'Failed to fetch critical patients count' });
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
  const { name, age, gender, department, diagnosis, bedId, hospitalId, doctorId } = req.body;

  try {
    const userId = (req.user as any)?.userId || (req.user as any)?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated - no userId in token' 
      });
    }

    const userFromDB = await prisma.user.findUnique({
      where: { id: userId },
      select: { hospitalId: true, name: true }
    });

    if (!userFromDB) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found in database' 
      });
    }

    if (!userFromDB.hospitalId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User has no hospital assigned. Please contact admin.' 
      });
    }

    const effectiveHospitalId = hospitalId || userFromDB.hospitalId;

    const count = await prisma.patient.count();
    const patientCode = `PT-${2040 + count + 1}`;

    const result = await prisma.$transaction(async (tx) => {
      let validBedId = null;
      
      if (bedId) {
        const bed = await tx.bed.findUnique({ where: { id: bedId } });
        if (!bed) throw new AdmitError('السرير غير موجود', 404);
        if (bed.status !== 'AVAILABLE') throw new AdmitError('السرير غير متاح حالياً', 400);
        validBedId = bedId;
      }

      const patientData: any = {
        patientCode,
        name,
        age: parseInt(age),
        gender,
        department,
        diagnosis,
        status: 'OBSERVATION',
        hospitalId: effectiveHospitalId, 
      };

      if (validBedId) patientData.bedId = validBedId;
      if (doctorId) patientData.doctorId = doctorId;

      const newPatient = await tx.patient.create({ data: patientData });

      if (validBedId) {
        await tx.bed.update({
          where: { id: bedId },
          data: { status: 'OCCUPIED' }
        });
      }

      return newPatient;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof AdmitError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    logger.error({ err: error }, '🔥 Admit error:');
    res.status(500).json({ 
      success: false, 
      message: 'فشل إدخال المريض' });
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

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
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
        uploadedBy: (req.user as any)?.userId,
      },
    });
    const { fileData: _fileData, ...report } = created;

    res.status(201).json({ success: true, message: 'Report uploaded', data: report });
  } catch (error: any) {
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
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report || !report.fileData) {
      return res.status(404).json({ success: false, message: 'File not found' });
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
      where: { patientId: id },
      omit: { fileData: true },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error: any) {
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

    const patient = await prisma.patient.findUnique({
      where: { id },
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
      return res.status(404).json({ success: false, message: 'المريض غير موجود' });
    }

    res.status(200).json({ success: true, data: patient });
  } catch (error: any) {
    logger.error({ err: error }, 'Get patient error:');
    res.status(500).json({ success: false, message: 'فشل جلب بيانات المريض' });
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

    const whereClause: any = {};

    if (status && status !== 'undefined' && status !== 'ALL' && status !== '' && status !== 'All') {
      whereClause.status = (status as string).toUpperCase(); 
    }

    if (department && department !== 'undefined' && department !== 'ALL' && department !== '' && department !== 'All') {
      whereClause.department = department;
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
  } catch (error: any) {
    logger.error({ err: error }, "🔥 Error:");
    res.status(500).json({ success: false, message: 'فشل جلب المرضى' });
  }
};

// ============================================
// GET /api/patients/beds/available
// ============================================
export const getAvailableBeds = async (req: Request, res: Response) => {
  try {
    const { department } = req.query;
    let beds: any[] = [];
    
    try {
      beds = await prisma.bed.findMany({ where: { status: 'AVAILABLE' }, orderBy: { bedNumber: 'asc' } });
    } catch (err: any) {
      logger.error({ err }, 'Get available beds error:');
      return res.status(500).json({ success: false, message: 'فشل جلب الأسرة المتاحة' });
    }

    let bedsWithWard: any[] = [];
    
    try {
      const testQuery = await prisma.bed.findFirst({ include: { ward: true } });
      if (testQuery) {
        bedsWithWard = await prisma.bed.findMany({
          where: { status: 'AVAILABLE' },
          include: {
            ward: {
              select: { id: true, name: true }
            }
          },
          orderBy: { bedNumber: 'asc' }
        });
      }
    } catch (wardErr: any) {
      bedsWithWard = beds.map(bed => ({
        ...bed, ward: { id: bed.wardId || 'unknown', name: 'General Ward' }
      }));
    }

    const finalBeds = bedsWithWard.length > 0 ? bedsWithWard : beds;

    const groupedByWard = finalBeds.reduce((acc: any, bed: any) => {
      const wardName = bed.ward?.name || 'General Ward';
      if (!acc[wardName]) acc[wardName] = [];
      acc[wardName].push(bed);
      return acc;
    }, {});

    res.status(200).json({ success: true, count: finalBeds.length, data: finalBeds, groupedByWard });
  } catch (error: any) {
    logger.error({ err: error }, 'Get available beds error:');
    res.status(500).json({ success: false, message: 'فشل جلب الأسرة المتاحة' });
  }
};

// ============================================
// PUT /api/patients/:id
// ============================================
export const updatePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const data = req.body;

    const updated = await prisma.patient.update({
      where: { id },
      data,
      include: { bed: true }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    logger.error({ err: error }, 'Update patient error:');
    res.status(500).json({ success: false, message: 'فشل تحديث المريض' });
  }
};

// ============================================
// PUT /api/patients/:id/discharge
// ============================================
export const dischargePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: { bed: true }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'المريض غير موجود' });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (patient.bedId) {
        await tx.bed.update({
          where: { id: patient.bedId },
          data: { status: 'AVAILABLE' }
        });
      }

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
  } catch (error: any) {
    logger.error({ err: error }, 'Discharge patient error:');
    res.status(500).json({ success: false, message: 'فشل تسريح المريض' });
  }
};