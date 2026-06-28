import { Request, Response } from 'express';
import prisma from '../config/db';
import { admitPatientSchema } from '../validators/patient.validator';

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

export const admitPatient = async (req: Request, res: Response) => {
  const validation = admitPatientSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({ success: false, errors: validation.error.errors });
  }

  const { name, age, condition, bedId, hospitalId, physicianName } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
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

export const uploadReport = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم رفع أي ملف' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'تم رفع التقرير بنجاح', 
      filePath: req.file.path 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'فشل رفع التقرير', error });
  }
};