import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const protect = (req: Request, res: Response, next: NextFunction): any => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'غير مصرح لك بالوصول: لا يوجد توكن' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    (req as any).user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'التوكن غير صالح أو منتهي الصلاحية' });
  }
};