// backend/src/controllers/bed.controller.ts
import { Request, Response } from 'express';
import prisma from '../config/db';

export const getAvailableBeds = async (req: Request, res: Response) => {
  try {
    const beds = await prisma.bed.findMany({
      where: { status: 'AVAILABLE' },
      select: {
        id: true,
        bedNumber: true,
        wardName: true,
      },
      orderBy: { wardName: 'asc' },
    });

    res.status(200).json({
      success: true,
      count: beds.length,
      data: beds,
    });
  } catch (error: any) {
    console.error('Get available beds error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available beds',
      error: error.message,
    });
  }
};