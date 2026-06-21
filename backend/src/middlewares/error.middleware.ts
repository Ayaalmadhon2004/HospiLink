import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack); // تسجيل الخطأ في الـ Console للمطور

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'حدث خطأ غير متوقع في السيرفر',
  });
};