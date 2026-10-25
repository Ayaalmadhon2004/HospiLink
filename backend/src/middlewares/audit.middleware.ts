import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';

export const logActivity = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;

      if (userId) {
        await prisma.auditLog.create({
          data: {
            action,
            userId,
            hospitalId: req.user?.hospitalId,
            entityId: req.body?.patientId || req.params.id || 'N/A',
            details: `User ${userId} performed ${action} on ${req.originalUrl}`
          }
        });
      }
    } catch (error) {
      logger.error({ err: error }, "Audit log failed:");
    }
    next();
  };
};