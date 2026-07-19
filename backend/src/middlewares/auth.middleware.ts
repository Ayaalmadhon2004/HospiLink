// src/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';  // ← أضف هاد

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

// ============================================
// protect — يتحقق من التوكن ويجيب role من DB
// ============================================

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;

  // 1. جرب JWT من Header أولاً (للـ Production)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. لو ما في → جرب الكوكيز (للـ Development)
  else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized — no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // ✅ جيب الـ user من DB عشان تاخد الـ role الحقيقي
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,  // ← من DB!
    };

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ============================================
// authorize — يتحقق من صلاحية الـ Role
// ============================================

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        error: 'You do not have permission to perform this action.',
        required: roles,
        current: userRole || 'none',
      });
    }
    next();
  };
};