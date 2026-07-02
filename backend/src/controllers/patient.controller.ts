// backend/src/controllers/patient.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';

// ============================================
// GET /api/patients/recent
// بيجيب آخر 5 مرضى تم إدخالهم (للـ Overview Dashboard)
// ============================================
export const getRecentPatients = async (req: Request, res: Response) => {
  try {
    if (!prisma) {
      throw new Error("Prisma client is not initialized");
    }

    const recentPatients = await prisma.patient.findMany({
      take: 5,           
      orderBy: { 
        admissionDate: 'desc' 
      },
      include: { 
        bed: true      
      },
    });

    res.status(200).json({ 
      success: true, 
      count: recentPatients.length,
      data: recentPatients 
    });

  } catch (error: any) {
    console.error("🔥 الخطأ من Prisma:", error);
    
    res.status(500).json({ 
        success: false, 
        message: 'فشل جلب قائمة المرضى', 
        details: error.message || 'خطأ غير معروف'
    });
  }
};

// ============================================
// POST /api/patients
// بيدخل مريض جديد + بيحجز السرير
// ============================================
export const admitPatient = async (req: Request, res: Response) => {
  const { name, age, gender, department, diagnosis, bedId, hospitalId, doctorId } = req.body;

  try {
    const count = await prisma.patient.count();
    const patientCode = `PT-${2040 + count + 1}`;

    const result = await prisma.$transaction(async (tx) => {
      const validBedId = bedId ? await tx.bed.findUnique({ where: { id: bedId } }) : null;
      
      const newPatient = await tx.patient.create({
        data: { 
          patientCode,
          name, 
          age: parseInt(age), 
          gender,
          department,
          diagnosis,
          bedId: validBedId ? bedId : null,
          hospitalId,
          doctorId: doctorId || null,
          status: 'OBSERVATION' 
        }
      });

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
    console.error('Admit error:', error);
    res.status(500).json({ success: false, message: 'فشل إدخال المريض', error: error.message });
  }
};

// ============================================
// POST /api/patients/:id/reports
// بيرفع ملف (PDF, Image) للمريض
// ============================================
export const uploadReport = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const patientId = req.params.id;
    
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const report = await prisma.report.create({
      data: {
        fileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        fileType: req.file.mimetype,
        patientId: patientId,
        uploadedBy: (req.user as any)?.userId,
      },
    });

    res.status(201).json({ success: true, message: 'Report uploaded', data: report });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload report', error: error.message });
  }
};

// ============================================
// GET /api/patients/:id/reports
// بيجيب تقارير مريض
// ============================================
export const getPatientReports = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reports = await prisma.report.findMany({
      where: { patientId: id },
      orderBy: { createdAt: 'desc' },
    });
    
    res.status(200).json({
      success: true,
      count: reports.length,
      data: reports,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message,
    });
  }
};

// ============================================
// GET /api/patients/:id
// بيجيب تفاصيل مريض واحد مع السرير والقسم
// ============================================
export const getPatientById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
    console.error('Get patient error:', error);
    res.status(500).json({ success: false, message: 'فشل جلب بيانات المريض', error: error.message });
  }
};

// ============================================
// GET /api/patients
// كل المرضى مع فلاتر — ✅ معدل وشغال
// ============================================
export const getPatients = async (req: Request, res: Response) => {
  try {
    // 1. استخراج المتغيرات من الـ Query
    const { status, department, search } = req.query;

    // 2. بناء كائن شرطي فارغ
    const whereClause: any = {};

    // 3. إضافة الشروط فقط إذا كانت القيم صالحة (Valid)
    if (status && status !== 'undefined' && status !== 'ALL' && status !== '' && status !== 'All') {
      // ✅ تحويل لـ UPPERCASE عشان يطابق الـ Enum
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

    // 4. تنفيذ الاستعلام باستخدام الكائن النظيف
    const patients = await prisma.patient.findMany({
      where: whereClause,
      orderBy: { admissionDate: 'desc' },
      include: {
        bed: {
          select: {
            bedNumber: true,
            ward: { select: { name: true } },
          },
        },
      },
    });

    res.status(200).json({ success: true, data: patients });
  } catch (error: any) {
    console.error("🔥 الخطأ من Prisma:", error);
    res.status(500).json({ success: false, message: 'فشل جلب المرضى', error: error.message });
  }
};

// ============================================
// PUT /api/patients/:id
// بيحدّث بيانات المريض
// ============================================
export const updatePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updated = await prisma.patient.update({
      where: { id },
      data,
      include: { bed: true }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تحديث المريض', error: error.message });
  }
};

// ============================================
// PUT /api/patients/:id/discharge
// بيخرج المريض من المستشفى
// ============================================
export const dischargePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
    res.status(500).json({ success: false, message: 'فشل تسريح المريض', error: error.message });
  }
};