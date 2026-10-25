// backend/src/controllers/devices.controller.ts
import crypto from 'crypto';
import { Request, Response } from 'express';
import prisma from '../config/db';
import logger from '../config/logger';
import { ok, fail } from '../utils/apiResponse';
import { hospitalIdOf } from '../utils/tenant';
import { hashDeviceKey, DeviceContext } from '../middlewares/deviceAuth.middleware';
import { ADAPTERS, IngestParseError, Protocol } from '../services/vitalsAdapters';
import { ingestReadings } from '../services/vitalsIngest';

const KEY_PUBLIC_FIELDS = { id: true, name: true, createdAt: true, lastUsedAt: true, revokedAt: true } as const;

// POST /api/devices (ADMIN): the plaintext key is returned once and never stored.
export const createDeviceKey = async (req: Request, res: Response) => {
  const key = `hl_${crypto.randomBytes(32).toString('base64url')}`;
  const row = await prisma.deviceKey.create({
    data: { hospitalId: hospitalIdOf(req), name: req.body.name, keyHash: hashDeviceKey(key) },
    select: KEY_PUBLIC_FIELDS,
  });
  return ok(res, { ...row, key }, { message: 'Store this key now: it cannot be shown again' }, 201);
};

// GET /api/devices (ADMIN)
export const listDeviceKeys = async (req: Request, res: Response) => {
  const rows = await prisma.deviceKey.findMany({ where: { hospitalId: hospitalIdOf(req) }, select: KEY_PUBLIC_FIELDS, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  return ok(res, rows, { count: rows.length });
};

// DELETE /api/devices/:id (ADMIN): revoke (the row stays for the audit trail)
export const revokeDeviceKey = async (req: Request, res: Response) => {
  const { count } = await prisma.deviceKey.updateMany({ where: { id: req.params.id as string, hospitalId: hospitalIdOf(req), revokedAt: null }, data: { revokedAt: new Date() } });
  if (count === 0) return fail(res, 404, 'NOT_FOUND', 'Device key not found');
  return ok(res, { id: req.params.id });
};

// POST /api/vitals/ingest/:protocol (x-device-key)
export const ingestVitals = async (req: Request, res: Response) => {
  const device = res.locals.device as DeviceContext;
  let readings;
  try {
    readings = ADAPTERS[req.params.protocol as Protocol](req.body);
  } catch (err) {
    if (err instanceof IngestParseError) return fail(res, 400, 'VALIDATION_ERROR', err.message);
    logger.error({ err }, 'Vitals adapter crashed');
    return fail(res, 400, 'VALIDATION_ERROR', 'Malformed payload');
  }
  const outcomes = await ingestReadings(device.hospitalId, device.id, readings);
  const stored = outcomes.filter((o) => o.status === 'stored').length;
  // 207: a batch may be partly accepted; the gateway retries only the rejected entries.
  return ok(res, outcomes, { stored, rejected: outcomes.length - stored }, stored === outcomes.length ? 201 : stored === 0 ? 422 : 207);
};
