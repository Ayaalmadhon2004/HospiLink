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
const ingestLimiter = rateLimit({ windowMs: 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many readings. Slow down.' } });
router.post(
  '/ingest/:protocol',
  ingestLimiter,
  express.text({ type: ['text/plain', 'x-application/hl7-v2+er7'], limit: '256kb' }),
  express.json({ type: ['application/json', 'application/fhir+json'], limit: '256kb' }),
  validate({ params: ingestParams }),
  deviceAuth,
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