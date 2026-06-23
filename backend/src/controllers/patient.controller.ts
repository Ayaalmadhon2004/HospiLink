import { Request, Response } from 'express';
import prisma from '../config/db';
import { admitPatientSchema } from '../validators/patient.validator';

export const getRecentPatients = async (req: Request, res: Response) => {
  try {
    // التحقق من أن اتصال بريزما يعمل (خطوة وقائية)
    if (!prisma) {
      throw new Error("Prisma client is not initialized");
    }

    const recentPatients = await prisma.patient.findMany({
      take: 5,
      // نستخدم orderBy مع التأكد من أن الحقل موجود في الـ Schema
      orderBy: { 
        admissionDate: 'desc' 
      },
      // نستخدم include لجلب بيانات السرير المرتبطة
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
    // هذا الجزء هو الذي سيخبركِ بالسر في Postman
    console.error("🔥 الخطأ من Prisma:", error);
    
    res.status(500).json({ 
        success: false, 
        message: 'فشل جلب قائمة المرضى', 
        details: error.message || 'خطأ غير معروف'
    });
  }
};

// 2. إدخال مريض جديد (مع الـ Transaction لضمان سلامة البيانات)
export const admitPatient = async (req: Request, res: Response) => {
  const validation = admitPatientSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({ success: false, errors: validation.error.errors });
  }

  const { name, age, condition, bedId, hospitalId, physicianName } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // إنشاء المريض
      const newPatient = await tx.patient.create({
        data: { 
          name, 
          age, 
          condition, 
          bedId, 
          hospitalId,
          physicianName,
          status: 'OBSERVATION' // الحالة الافتراضية عند الإدخال
        }
      });

      // حجز السرير
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

// أضيفي هذا في ملف: backend/src/controllers/patient.controller.ts

export const uploadReport = async (req: Request, res: Response) => {
  try {
    // تأكدي من التعامل مع الملف المرفوع (مخزن في req.file)
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم رفع أي ملف' });
    }

    // هنا تضعين منطق حفظ مسار الملف في قاعدة البيانات
    // مثال:
    // await prisma.patientReport.create({ data: { path: req.file.path, ... } });

    res.status(200).json({ 
      success: true, 
      message: 'تم رفع التقرير بنجاح', 
      filePath: req.file.path 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'فشل رفع التقرير', error });
  }
};