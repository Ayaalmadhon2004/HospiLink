// backend/src/controllers/bed.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { BedRuleError, claimBed, releaseBed } from '../services/bedAssignment';
import type { Prisma } from '@prisma/client';

const isUniqueViolation = (error: unknown): boolean => (error as { code?: unknown })?.code === 'P2002';

const BED_INCLUDE = {
  ward: { select: { name: true } },
  patient: { select: { name: true, id: true } },
} satisfies Prisma.BedInclude;

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
    if (!bed) return res.status(404).json({ success: false, code: 'BED_NOT_FOUND', message: 'Bed not found' });
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

    // OCCUPIED <=> has a patient, and a brand new bed has none.
    if (status === 'OCCUPIED') {
      return res.status(400).json({ success: false, message: 'A new bed has no patient: it cannot be OCCUPIED' });
    }

    const ward = await prisma.ward.findFirst({ where: { id: wardId, hospitalId }, select: { id: true } });
    if (!ward) return res.status(404).json({ success: false, code: 'WARD_NOT_FOUND', message: 'Ward not found' });

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
    if (isUniqueViolation(error)) {
      return res.status(409).json({ success: false, message: 'A bed with this number already exists in the ward' });
    }
    logger.error({ err: error }, 'Create bed error:');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// تحديث سرير
// Invariant: a bed is OCCUPIED if and only if a patient is assigned to it.
//  - patientId (assign): the bed becomes OCCUPIED, the patient leaves their previous bed; a bed that already has
//    another patient or is not AVAILABLE answers 409; a conflicting status in the same request is a 400.
//  - patientId null / '' (unassign): the patient leaves the bed, which becomes AVAILABLE unless another non-OCCUPIED status is given.
//  - status only: OCCUPIED needs a patient already there (400); any other status on a bed with a patient is a 409.
export const updateBedStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status, patientId, wardId, bedNumber } = req.body;
    const hospitalId = hospitalIdOf(req); // never from the body

    const existing = await prisma.bed.findFirst({
      where: { id, hospitalId },
      select: { id: true, patient: { select: { id: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, code: 'BED_NOT_FOUND', message: 'Bed not found' });

    // Related records must belong to the same hospital as the bed.
    if (wardId && !(await prisma.ward.findFirst({ where: { id: wardId, hospitalId }, select: { id: true } }))) {
      return res.status(404).json({ success: false, code: 'WARD_NOT_FOUND', message: 'Ward not found' });
    }

    const assigning = typeof patientId === 'string' && patientId !== '';
    const unassigning = patientId === null || patientId === '';
    if (assigning && status && status !== 'OCCUPIED') {
      return res.status(400).json({ success: false, message: 'A bed with a patient must be OCCUPIED' });
    }
    if (unassigning && status === 'OCCUPIED') {
      return res.status(400).json({ success: false, message: 'A bed without a patient cannot be OCCUPIED' });
    }
    if (patientId === undefined && status === 'OCCUPIED' && !existing.patient) {
      return res.status(400).json({ success: false, message: 'Assign a patient to mark the bed as occupied' });
    }
    if (patientId === undefined && status && status !== 'OCCUPIED' && existing.patient) {
      return res.status(409).json({ success: false, message: 'The bed has a patient: unassign, move or discharge the patient first' });
    }

    const bed = await prisma.$transaction(async (tx) => {
      const data: Prisma.BedUpdateInput = {};
      if (bedNumber) data.bedNumber = bedNumber;
      if (wardId) data.ward = { connect: { id: wardId } };

      if (assigning) {
        if (existing.patient?.id !== patientId) {
          const patient = await tx.patient.findFirst({ where: { id: patientId, hospitalId }, select: { id: true, bedId: true, status: true } });
          if (!patient) throw new BedRuleError(404, 'Patient not found');
          if (patient.status === 'DISCHARGED') throw new BedRuleError(400, 'A discharged patient cannot be assigned a bed');
          if (existing.patient) throw new BedRuleError(409, 'The bed is already occupied by another patient');
          await claimBed(tx, id, hospitalId); // atomic: only a free AVAILABLE bed
          if (patient.bedId) await releaseBed(tx, patient.bedId, hospitalId);
          await tx.patient.update({ where: { id: patient.id }, data: { bedId: id } });
        }
        data.status = 'OCCUPIED';
      } else if (unassigning) {
        if (existing.patient) await tx.patient.update({ where: { id: existing.patient.id }, data: { bedId: null } });
        data.status = status ?? 'AVAILABLE';
      } else if (status) {
        data.status = status;
      }

      return tx.bed.update({ where: { id }, data, include: BED_INCLUDE });
    });
    res.status(200).json({ success: true, data: bed });
  } catch (error: unknown) {
    if (error instanceof BedRuleError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (isUniqueViolation(error)) {
      return res.status(409).json({ success: false, message: 'A bed with this number already exists in the ward' });
    }
    logger.error({ err: error }, 'Update bed error:');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// حذف سرير
export const deleteBed = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.bed.findFirst({
      where: { id, hospitalId: hospitalIdOf(req) },
      select: { id: true, patient: { select: { id: true } } },
    });
    if (!existing) return res.status(404).json({ success: false, code: 'BED_NOT_FOUND', message: 'Bed not found' });
    if (existing.patient) {
      return res.status(409).json({ success: false, message: 'The bed has a patient: move or discharge the patient first' });
    }
    await prisma.bed.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Bed deleted' });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Delete bed error:');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};