import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const protect = (req: Request, res: Response, next: NextFunction): void => {
  // ✅ اقرأ التوكن من الكوكي، مش من Bearer header
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: 'غير مصرح لك بالوصول: لا يوجد توكن في الكوكيز' });
    return;
  }

  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined in environment variables");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (error) {
    res.status(403).json({ error: 'التوكن غير صالح أو منتهي الصلاحية' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req.user as any)?.role; 

    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية للوصول لهذا المسار' });
    }
    next();
  };
};