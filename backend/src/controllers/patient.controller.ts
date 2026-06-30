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
          bedId: validBedId ? bedId : null,  // ← بس لو موجود
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
// Add this import if not already

// Update uploadReport
export const uploadReport = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const patientId = req.params.id;
    
    if (!patientId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }

    // تأكد إن المريض موجود
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

// Add getPatientReports
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
// NEW: GET /api/patients
// بيجيب كل المرضى مع فلاتر (للـ Patients Page)
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
            ward: { select: { name: true } }  // ← NEW
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
// NEW: GET /api/patients/:id
// بيجيب تفاصيل مريض واحد (للـ Patient Detail Page)
// ============================================
export const getPatientById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        bed: true,
        // ✅ ممكن نضيف vitals, reports هون لاحقاً
      }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'المريض غير موجود' });
    }

    res.status(200).json({ success: true, data: patient });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب بيانات المريض', error: error.message });
  }
};

// ============================================
// NEW: PUT /api/patients/:id
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
// NEW: PUT /api/patients/:id/discharge
// بيخرج المريض من المستشفى
// ============================================
export const dischargePatient = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // ✅ لازم نجيب المريض الأول عشان نعرف bedId
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: { bed: true }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'المريض غير موجود' });
    }

    // ✅ Transaction: حدّث المريض + حرّر السرير
    const result = await prisma.$transaction(async (tx) => {
      // 1. حرّر السرير (لو فيه)
      if (patient.bedId) {
        await tx.bed.update({
          where: { id: patient.bedId },
          data: { status: 'AVAILABLE' }
        });
      }

      // 2. حدّث المريض
      const updated = await tx.patient.update({
        where: { id },
        data: {
          status: 'DISCHARGED',
          dischargeDate: new Date(),
          bedId: null  // ← فك الارتباط بالسرير
        }
      });

      return updated;
    });

    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل تسريح المريض', error: error.message });
  }
};
