import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { captureServerError } from '../config/sentry';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');

  if (!err.status || err.status >= 500) captureServerError(err);

  const status: number = err.status || 500;
  const fallback = 'حدث خطأ غير متوقع في السيرفر';

  // لا نكشف رسائل الأخطاء الداخلية للعميل (5xx)؛ رسائل 4xx آمنة
  res.status(status).json({
    success: false,
    message: status >= 500 ? fallback : err.message || fallback,
  });
};
