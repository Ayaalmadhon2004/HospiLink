// backend/src/routes/incidents.routes.ts
import { Router } from 'express';
import {
  getIncidents,
  getActiveIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  updateIncidentStatus,
  deleteIncident, // ✅ Added
} from '../controllers/incidents.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';

const router = Router();

// Specific routes first!
router.get('/active', protect, getActiveIncidents);

// General routes
router.get('/', protect, getIncidents);
router.get('/:id', protect, getIncidentById);
router.post(
  '/',
  protect,
  authorize('ADMIN', 'DOCTOR', 'NURSE'),
  logActivity('CREATE_INCIDENT'),
  createIncident
);
router.put(
  '/:id',
  protect,
  authorize('ADMIN', 'DOCTOR'),
  logActivity('UPDATE_INCIDENT'),
  updateIncident
);
router.put(
  '/:id/status',
  protect,
  authorize('ADMIN', 'DOCTOR'),
  logActivity('UPDATE_INCIDENT_STATUS'),
  updateIncidentStatus
);

// ✅ NEW: DELETE route
router.delete(
  '/:id',
  protect,
  authorize('ADMIN', 'DOCTOR'),
  logActivity('DELETE_INCIDENT'),
  deleteIncident
);

export default router;