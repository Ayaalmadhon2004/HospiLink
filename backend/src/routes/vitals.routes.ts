import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  recordVitals,
  getVitals,
  getCriticalAlerts,
  getVitalsById,
  updateVitals,
  deleteVitals,
  getThresholds,
  upsertThreshold,
  deleteThreshold,
} from '../controllers/vitals.controller';
import { ingestVitals } from '../controllers/devices.controller';
import { deviceAuth } from '../middlewares/deviceAuth.middleware';
import { ingestParams } from '../validators/devices.validator';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { validate } from '../middlewares/validate.middleware';
import { idParams } from '../validators/common.validator';
import { recordVitalsSchema, updateVitalsSchema, vitalsQuerySchema, vitalsAlertsQuerySchema, upsertThresholdSchema, thresholdsQuerySchema } from '../validators/vitals.validator';

const router = Router();

// Device ingestion (HL7 v2 / FHIR / JSON). Declared before the `/:id` routes; authenticated by x-device-key, not a user.
//
// Rate limiting is deliberately NOT per IP for valid devices: a hospital gateway (or NAT) funnels every bedside device through one
// address, and 50 devices x 1 reading/s is 3 000 requests/min, far over any sane per-IP limit (found by perf/vitals-ingest.js).
// Instead:
//   1. a failure limiter per IP counts only REJECTED requests (bad key, bad payload): guessing or a broken device is cut off,
//      and random keys cannot create unbounded limiter state because the next limiter only ever sees authenticated devices;
//   2. a per-DEVICE-KEY limiter (default 6 000 readings-requests/min, `INGEST_RATE_LIMIT_MAX`) after authentication: a leaked or
//      runaway key cannot flood the database, and one noisy key cannot starve another hospital's devices.
// server.ts exempts this path from the general per-IP API limiter for the same reason.
const ingestFailureLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many rejected device requests. Check the device key and payload.' },
});
const ingestMax = Number(process.env.INGEST_RATE_LIMIT_MAX);
const ingestPerDeviceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number.isInteger(ingestMax) && ingestMax > 0 ? ingestMax : 6000,
  standardHeaders: true,
  legacyHeaders: false,
  // Runs after deviceAuth: the key is the authenticated device, never client-chosen text.
  keyGenerator: (_req, res) => `device:${(res.locals.device as { id: string }).id}`,
  message: { success: false, message: 'This device key is sending too many requests. Slow down or batch readings.' },
});
router.post(
  '/ingest/:protocol',
  ingestFailureLimiter,
  express.text({ type: ['text/plain', 'x-application/hl7-v2+er7'], limit: '256kb' }),
  express.json({ type: ['application/json', 'application/fhir+json'], limit: '256kb' }),
  validate({ params: ingestParams }),
  deviceAuth,
  ingestPerDeviceLimiter,
  ingestVitals
);

router.post(
  '/',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  validate({ body: recordVitalsSchema }),
  logActivity('RECORD_VITALS'),
  recordVitals
);

// GET /api/vitals - Get vitals list (any authenticated user)
router.get('/', protect, validate({ query: vitalsQuerySchema }), getVitals);

// GET /api/vitals/alerts - Get critical alerts (DOCTOR, NURSE, ADMIN)
router.get('/alerts', protect, authorize('DOCTOR', 'NURSE', 'ADMIN'), validate({ query: vitalsAlertsQuerySchema }), getCriticalAlerts);

// Thresholds (declared BEFORE '/:id' so they are not swallowed by it)
router.get('/thresholds', protect, authorize('DOCTOR', 'NURSE', 'ADMIN'), validate({ query: thresholdsQuerySchema }), getThresholds);
router.put('/thresholds', protect, authorize('DOCTOR', 'ADMIN'), validate({ body: upsertThresholdSchema }), logActivity('UPSERT_VITAL_THRESHOLD'), upsertThreshold);
router.delete('/thresholds/:id', protect, authorize('DOCTOR', 'ADMIN'), validate({ params: idParams }), logActivity('DELETE_VITAL_THRESHOLD'), deleteThreshold);

// GET /api/vitals/:id - Get single vitals entry
router.get('/:id', protect, validate({ params: idParams }), getVitalsById);

// PUT /api/vitals/:id - Update vitals (DOCTOR, NURSE)
router.put('/:id', protect, authorize('DOCTOR', 'NURSE'), validate({ params: idParams, body: updateVitalsSchema }), logActivity('UPDATE_VITALS'), updateVitals);

// DELETE /api/vitals/:id - Delete vitals (ADMIN only)
router.delete('/:id', protect, authorize('ADMIN'), validate({ params: idParams }), logActivity('DELETE_VITALS'), deleteVitals);

export default router;