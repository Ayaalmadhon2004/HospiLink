// backend/src/controllers/bed.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';

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
    const id = req.params.id as string;
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
    const { bedNumber, wardId, status, hospitalId } = req.body;
    
    if (!bedNumber || !wardId || !hospitalId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: bedNumber, wardId, hospitalId'
      });
    }

    const bed = await prisma.bed.create({
      data: {
        bedNumber,
        status: status || 'AVAILABLE',
        ward: { connect: { id: wardId } },
        hospital: { connect: { id: hospitalId } }
      },
      include: {
        ward: { select: { name: true } },
        patient: { select: { name: true, id: true } }
      }
    });
    res.status(201).json({ success: true, data: bed });
  } catch (error: any) {
    console.error('Create bed error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// تحديث سرير
export const updateBedStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, patientId, wardId, bedNumber, hospitalId } = req.body;
    
    const data: any = {};
    
    if (bedNumber) data.bedNumber = bedNumber;
    if (status) data.status = status;
    if (wardId) data.ward = { connect: { id: wardId } };
    if (hospitalId) data.hospital = { connect: { id: hospitalId } };
    
    if (patientId === null || patientId === '') {
      data.patient = { disconnect: true };
    } else if (patientId) {
      data.patient = { connect: { id: patientId } };
    }

    const bed = await prisma.bed.update({
      where: { id },
      data,
      include: {
        ward: { select: { name: true } },
        patient: { select: { name: true, id: true } }
      }
    });
    res.status(200).json({ success: true, data: bed });
  } catch (error: any) {
    console.error('Update bed error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// حذف سرير
export const deleteBed = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.bed.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'تم حذف السرير' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};