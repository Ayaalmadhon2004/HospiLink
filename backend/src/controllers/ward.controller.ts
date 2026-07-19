import { Request, Response } from 'express';
import prisma from '../config/db';

// GET /api/wards - كل الأقسام
export const getAllWards = async (req: Request, res: Response) => {
  try {
    const wards = await prisma.ward.findMany({
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: wards });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/wards/:id - قسم واحد
export const getWardById = async (req: Request, res: Response) => {
  try {
  const { id } = req.params as { id: string }
  const ward = await prisma.ward.findUnique({
      where: { id },
      include: {
        beds: {
          include: {
            patient: { select: { name: true, id: true } }
          }
        }
      }
    });
    if (!ward) return res.status(404).json({ success: false, message: 'Ward not found' });
    res.status(200).json({ success: true, data: ward });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};