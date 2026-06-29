import prisma from "../config/db";
import { Request, Response } from 'express';

export const getAvailableBeds = async (req: Request, res: Response) => {
  try {
    const beds = await prisma.bed.findMany({
      where: { status: 'AVAILABLE' },
      select: { id: true, bedNumber: true, wardName: true }
    });
    res.json({ success: true, data: beds });
  } catch (error) {
    res.status(500).json({ success: false, message: 'فشل جلب الأسرة' });
  }
};