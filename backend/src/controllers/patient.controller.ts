import { Request, Response } from 'express';
import { prisma } from '../config/db';
import { admitPatientSchema } from '../validators/patient.validator';

export const admitPatient = async (req: Request, res: Response) => {
  // 1. التحقق من البيانات
  const validation = admitPatientSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({ success: false, errors: validation.error.errors });
  }

  const { name, age, condition, bedId, hospitalId } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 2. إنشاء المريض
      const newPatient = await tx.patient.create({
        data: { name, age, condition, bedId, hospitalId }
      });

      // 3. تحديث السرير
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