import { Request, Response } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';

// GET /api/wards - كل الأقسام
export const getAllWards = async (req: Request, res: Response) => {
  try {
    const wards = await prisma.ward.findMany({
      where: { hospitalId: hospitalIdOf(req) },
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: wards });
  } catch (error: unknown) {
    logger.error({ err: error }, 'Ward error:');
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
