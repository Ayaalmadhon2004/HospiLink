// backend/src/utils/apiResponse.ts
//
// One response contract for the whole API:
//   success: { success: true,  data?, message?, pagination? }
//   failure: { success: false, error: { code, message, details? } }
// `code` is machine-readable (the frontend translates it, see errors.codes.* in the locale files);
// `message` is English and for developers/logs only.
// Transitional: failures also keep the legacy top-level `message` / `code` / `errors` for one release,
// and login/register keep top-level `token` / `user` next to `data`. Remove once clients read the new shape.
import type { NextFunction, Request, Response } from 'express';

export type ErrorCode =
  | 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'RATE_LIMITED' | 'INTERNAL_ERROR'
  | 'ACCOUNT_PENDING' | 'ACCOUNT_DISABLED' | 'EMAIL_NOT_VERIFIED' | 'TWO_FACTOR_LOCKED'
  | 'PATIENT_NOT_FOUND' | 'BED_NOT_FOUND' | 'WARD_NOT_FOUND' | 'STAFF_NOT_FOUND' | 'USER_NOT_FOUND'
  | 'APPOINTMENT_NOT_FOUND' | 'SHIFT_NOT_FOUND' | 'INCIDENT_NOT_FOUND' | 'VITALS_NOT_FOUND' | 'DOCTOR_NOT_FOUND'
  | 'WARD_HAS_BEDS' | 'LAST_ADMIN' | 'UNIT_NOT_FOUND' | 'THRESHOLD_NOT_FOUND' | 'FILE_NOT_FOUND';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

const STATUS_CODES: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
};

export const codeForStatus = (status: number): ErrorCode => STATUS_CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR');

export const ok = <T>(res: Response, data: T, extra: Record<string, unknown> = {}, status = 200): Response =>
  res.status(status).json({ success: true, data, ...extra });

export const fail = (res: Response, status: number, code: ErrorCode | string, message: string, details?: unknown): Response =>
  res.status(status).json({
    success: false,
    message,
    code,
    ...(code === 'VALIDATION_ERROR' && details !== undefined ? { errors: details } : {}),
    error: { code, message, ...(details === undefined ? {} : { details }) },
  });

const DEFAULT_MESSAGE = 'Request failed';

/** Rewrites any failure body (`{ success:false, message }`, legacy `{ error: 'text' }`) into the unified shape. */
export const toErrorBody = (status: number, body: unknown): unknown => {
  if (status < 400 || typeof body !== 'object' || body === null || Array.isArray(body)) return body;
  const b = body as Record<string, unknown>;
  if (typeof b.error === 'object' && b.error !== null) return body; // already unified
  if (b.success !== false && typeof b.error !== 'string') return body; // a success body

  const message = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : DEFAULT_MESSAGE;
  const code = typeof b.code === 'string' ? b.code : codeForStatus(status);
  const details = b.errors ?? (b.required !== undefined ? { required: b.required, current: b.current } : undefined);
  const { error: _legacy, ...rest } = b;
  return { ...rest, success: false, message, code, error: { code, message, ...(details === undefined ? {} : { details }) } };
};

/** Mount before the routes: every failure leaves the API in the unified shape, whichever layer produced it. */
export const errorEnvelope = (_req: Request, res: Response, next: NextFunction): void => {
  const json = res.json.bind(res);
  res.json = (body?: unknown) => json(toErrorBody(res.statusCode, body));
  next();
};
