import { Request, Response } from 'express';
import prisma from '../config/db';
import { admitPatientSchema } from '../validators/patient.validator';

// ============================================
// GET /api/patients/recent
// بيجيب آخر 5 مرضى تم إدخالهم (للـ Overview Dashboard)
// ============================================
export const getRecentPatients = async (req: Request, res: Response) => {
  try {
    // ✅ تحقق إضافي: Prisma شغال؟
    // ليش: لو فيه مشكلة في الاتصال بـ DB، نعطي error واضح بدل ما يكراش السيرفر
    if (!prisma) {
      throw new Error("Prisma client is not initialized");
    }

    const recentPatients = await prisma.patient.findMany({
      take: 5,           // ← بس 5 مرضى (للـ Overview)
      orderBy: { 
        admissionDate: 'desc'  // ← الأحدث أولاً
      },
      include: { 
        bed: true        // ← جيب بيانات السرير كمان
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
  // ✅ Validation بـ Zod
  // ليش: نتأكد إن البيانات صح قبل ما ندخلها DB (نوع، طول، required...)
  const validation = admitPatientSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({ success: false, errors: validation.error.errors });
  }

  const { name, age, condition, bedId, hospitalId, physicianName } = validation.data;

  try {
    // ✅ Transaction
    // ليش: لو Patient اتعمل بس Bed ما اتحدثش، بصير بيانات غلط!
    // Transaction = كل العمليات بتنجح أو كلها بتفشل (Atomic)
    const result = await prisma.$transaction(async (tx) => {
      // 1. أنشئ المريض
      const newPatient = await tx.patient.create({
        data: { 
          name, 
          age, 
          condition, 
          bedId, 
          hospitalId,
          physicianName,
          status: 'OBSERVATION' 
        }
      });

      // 2. حدّث السرير لـ OCCUPIED
      await tx.bed.update({
        where: { id: bedId },
        data: { status: 'OCCUPIED' }
      });

      return newPatient;
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'فشل إدخال المريض', error });
  }
};

// ============================================
// POST /api/patients/:id/reports
// بيرفع ملف (PDF, Image) للمريض
// ============================================
export const uploadReport = async (req: Request, res: Response) => {
  try {
    // ✅ Multer بيحط الملف في req.file
    // ليش: بدون Multer، req.file = undefined
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم رفع أي ملف' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'تم رفع التقرير بنجاح', 
      filePath: req.file.path   // ← مسار الملف المحفوظ
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'فشل رفع التقرير', error });
  }
};

// ============================================
// NEW: GET /api/patients
// بيجيب كل المرضى مع فلاتر (للـ Patients Page)
// ============================================
export const getPatients = async (req: Request, res: Response) => {
  try {
    const { status, department, search } = req.query;
    
    // ✅ Dynamic Where
    // ليش: نبني الـ query حسب الفلاتر الي جاي من Frontend
    const where: any = {};
    
    if (status && status !== 'All') {
      where.status = status;
    }
    
    if (department && department !== 'All') {
      where.department = department;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { patientCode: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const patients = await prisma.patient.findMany({
      where,
      include: {
        bed: { select: { bedNumber: true, wardName: true } },
        // ✅ Select بدل include كامل
        // ليش: ما نجيبش بيانات زيادة (performance)
      },
      orderBy: { admissionDate: 'desc' }
    });

    res.status(200).json({ success: true, count: patients.length, data: patients });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'فشل جلب المرضى', error: error.message });
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