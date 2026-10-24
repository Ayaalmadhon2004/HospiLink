import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { captureServerError } from '../config/sentry';
import { codeForStatus, fail } from '../utils/apiResponse';

interface HttpError {
  status?: number;
  code?: string;
  message?: string;
  stack?: string;
}

export const errorHandler = (err: HttpError, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');

  if (!err.status || err.status >= 500) captureServerError(err);

  const status: number = err.status || 500;
  const fallback = 'Unexpected server error';

  // لا نكشف رسائل الأخطاء الداخلية للعميل (5xx)؛ رسائل 4xx آمنة
  fail(res, status, status >= 500 ? 'INTERNAL_ERROR' : err.code ?? codeForStatus(status), status >= 500 ? fallback : err.message || fallback);
};
