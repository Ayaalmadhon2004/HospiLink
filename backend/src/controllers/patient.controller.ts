import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { admitPatientSchema } from '../validators/patient.validator';

// 1. جلب آخر 5 مرضى للداشبورد
export const getRecentPatients = async (req: Request, res: Response) => {
  try {
    const recentPatients = await prisma.patient.findMany({
      take: 5,
      orderBy: {
        admissionDate: 'desc', // الأحدث أولاً
      },
      include: {
        bed: true, // جلب تفاصيل الغرفة والسرير
      },
    });

    res.status(200).json({ success: true, data: recentPatients });
  } catch (error) {
    res.status(500).json({ success: false, message: 'فشل جلب قائمة المرضى', error });
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