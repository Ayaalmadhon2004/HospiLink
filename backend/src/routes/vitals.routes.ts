import { Router } from 'express';
import {
  recordVitals,
  getVitals,
  getCriticalAlerts,
  getVitalsById,
  updateVitals,
  deleteVitals,
} from '../controllers/vitals.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';

const router = Router();

router.post(
  '/',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  logActivity('RECORD_VITALS'),
  recordVitals
);

// GET /api/vitals - Get vitals list (any authenticated user)
router.get('/', protect, getVitals);

// GET /api/vitals/alerts - Get critical alerts (DOCTOR, NURSE, ADMIN)
router.get('/alerts', protect, authorize('DOCTOR', 'NURSE', 'ADMIN'), getCriticalAlerts);

// GET /api/vitals/:id - Get single vitals entry
router.get('/:id', protect, getVitalsById);

// PUT /api/vitals/:id - Update vitals (DOCTOR, NURSE)
router.put('/:id', protect, authorize('DOCTOR', 'NURSE'), logActivity('UPDATE_VITALS'), updateVitals);

// DELETE /api/vitals/:id - Delete vitals (ADMIN only)
router.delete('/:id', protect, authorize('ADMIN'), logActivity('DELETE_VITALS'), deleteVitals);

export default router;