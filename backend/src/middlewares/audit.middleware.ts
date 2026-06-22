import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const logActivity = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // نأخذ الـ userId من التوكن (الذي وضعناه في الـ authMiddleware)
      const userId = (req as any).user?.id; 

      if (userId) {
        await prisma.auditLog.create({
          data: {
            action,
            userId,
            entityId: req.body.patientId || req.params.id || 'N/A',
            details: `User ${userId} performed ${action} on ${req.originalUrl}`
          }
        });
      }
    } catch (error) {
      console.error("Audit log failed:", error);
    }
    next();
  };
};