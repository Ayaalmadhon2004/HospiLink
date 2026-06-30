import { Request, Response } from 'express';
import prisma from '../config/db';  // ← استخدم نفس الـ prisma instance

// جلب كل السراير
export const getAllBeds = async (req: Request, res: Response) => {
  try {
    const beds = await prisma.bed.findMany({
      include: {
        ward: { select: { name: true } },
        patient: { select: { name: true, id: true } }
      }
    });
    res.status(200).json({ success: true, data: beds });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// جلب سرير حسب ID
export const getBedById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bed = await prisma.bed.findUnique({
      where: { id },
      include: {
        ward: { select: { name: true } },
        patient: { select: { name: true, id: true } }
      }
    });
    if (!bed) return res.status(404).json({ success: false, message: 'السرير غير موجود' });
    res.status(200).json({ success: true, data: bed });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// إنشاء سرير جديد
export const createBed = async (req: Request, res: Response) => {
  try {
    const { bedNumber, wardId } = req.body;
    const bed = await prisma.bed.create({
      data: { bedNumber, wardId },
      include: { ward: { select: { name: true } } }
    });
    res.status(201).json({ success: true, data: bed });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// تحديث حالة السرير
export const updateBedStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, patientId } = req.body;
    
    const bed = await prisma.bed.update({
      where: { id },
      data: { status, patientId },
      include: {
        ward: { select: { name: true } },
        patient: { select: { name: true } }
      }
    });
    res.status(200).json({ success: true, data: bed });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// حذف سرير
export const deleteBed = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.bed.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'تم حذف السرير' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};