// backend/src/routes/exports.routes.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { protect, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { exportParams, exportQuery } from '../validators/exports.validator';
import { exportData } from '../controllers/exports.controller';

const router = Router();

// Exports are heavy and carry bulk patient data: a tight per-IP limit on top of the general API limiter.
const exportLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many exports. Please wait a minute.' } });

// Route-level gate is the widest role set; the controller narrows it per dataset (billing = ADMIN).
router.get('/:type', exportLimiter, protect, authorize('ADMIN', 'DOCTOR'), validate({ params: exportParams, query: exportQuery }), logActivity('EXPORT_DATA'), exportData);

export default router;
