import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'حدث خطأ غير متوقع في السيرفر',
  });
};