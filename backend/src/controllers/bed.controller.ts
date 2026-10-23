// backend/src/controllers/bed.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import type { Prisma } from '@prisma/client';

// جلب كل السراير
export const getAllBeds = async (req: Request, res: Response) => {
  try {
    const beds = await prisma.bed.findMany({
      where: { hospitalId: hospitalIdOf(req) },
      include: {
        ward: { select: { name: true } },
        patient: { select: { name: true, id: true } }
      }
    });
    res.status(200).json({ success: true, data: beds });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get beds error:');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// جلب سرير حسب ID
export const getBedById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const bed = await prisma.bed.findFirst({
      where: { id, hospitalId: hospitalIdOf(req) },
      include: {
        ward: { select: { name: true } },
        patient: { select: { name: true, id: true } }
      }
    });
    if (!bed) return res.status(404).json({ success: false, message: 'السرير غير موجود' });
    res.status(200).json({ success: true, data: bed });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Get bed error:');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// إنشاء سرير جديد
export const createBed = async (req: Request, res: Response) => {
  try {
    const { bedNumber, wardId, status } = req.body;
    const hospitalId = hospitalIdOf(req); // never from the body

    if (!bedNumber || !wardId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: bedNumber, wardId'
      });
    }

    const ward = await prisma.ward.findFirst({ where: { id: wardId, hospitalId }, select: { id: true } });
    if (!ward) return res.status(404).json({ success: false, message: 'Ward not found' });

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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Create bed error:');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// تحديث سرير
export const updateBedStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, patientId, wardId, bedNumber } = req.body;
    const hospitalId = hospitalIdOf(req); // never from the body

    const existing = await prisma.bed.findFirst({ where: { id, hospitalId }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'السرير غير موجود' });

    // Related records must belong to the same hospital as the bed.
    if (wardId && !(await prisma.ward.findFirst({ where: { id: wardId, hospitalId }, select: { id: true } }))) {
      return res.status(404).json({ success: false, message: 'Ward not found' });
    }
    if (patientId && !(await prisma.patient.findFirst({ where: { id: patientId, hospitalId }, select: { id: true } }))) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const data: Prisma.BedUpdateInput = {};
    
    if (bedNumber) data.bedNumber = bedNumber;
    if (status) data.status = status;
    if (wardId) data.ward = { connect: { id: wardId } };
    
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
  } catch (error: unknown) {
    logger.error({ err: error }, 'Update bed error:');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// حذف سرير
export const deleteBed = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.bed.findFirst({ where: { id, hospitalId: hospitalIdOf(req) }, select: { id: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'السرير غير موجود' });
    await prisma.bed.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'تم حذف السرير' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete bed error:');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};