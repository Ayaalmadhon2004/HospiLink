// backend/src/middlewares/deviceAuth.middleware.ts
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';
import { fail } from '../utils/apiResponse';

export const hashDeviceKey = (key: string): string => crypto.createHash('sha256').update(key).digest('hex');

export interface DeviceContext { id: string; hospitalId: string }

// Machine-to-machine auth for the ingest endpoint: header `x-device-key`, never a user session. The hospital
// comes from the key row, so a device can only ever write to its own hospital.
export const deviceAuth = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers['x-device-key'];
  const key = typeof header === 'string' ? header : '';
  if (!key) return fail(res, 401, 'UNAUTHORIZED', 'Missing x-device-key header');
  try {
    const row = await prisma.deviceKey.findFirst({ where: { keyHash: hashDeviceKey(key), revokedAt: null }, select: { id: true, hospitalId: true } });
    if (!row) return fail(res, 401, 'UNAUTHORIZED', 'Invalid or revoked device key');
    res.locals.device = row satisfies DeviceContext;
    // Best effort: a failed bookkeeping write must not drop a clinical reading.
    prisma.deviceKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch((err: unknown) => logger.warn({ err }, 'deviceKey lastUsedAt update failed'));
    return next();
  } catch (err) {
    logger.error({ err }, 'Device auth failed');
    return fail(res, 500, 'INTERNAL_ERROR', 'Authentication failed');
  }
};
