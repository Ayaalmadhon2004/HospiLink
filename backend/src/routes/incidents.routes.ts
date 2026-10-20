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
import { validate } from '../middlewares/validate.middleware';
import { idParams } from '../validators/common.validator';
import { createIncidentSchema, updateIncidentSchema, updateIncidentStatusSchema, incidentQuerySchema } from '../validators/incident.validator';

const router = Router();

// Specific routes first!
router.get('/active', protect, getActiveIncidents);

// General routes
router.get('/', protect, validate({ query: incidentQuerySchema }), getIncidents);
router.get('/:id', protect, validate({ params: idParams }), getIncidentById);
router.post(
  '/',
  protect,
  authorize('ADMIN', 'DOCTOR', 'NURSE'),
  validate({ body: createIncidentSchema }),
  logActivity('CREATE_INCIDENT'),
  createIncident
);
router.put(
  '/:id',
  protect,
  authorize('ADMIN', 'DOCTOR'),
  validate({ params: idParams, body: updateIncidentSchema }),
  logActivity('UPDATE_INCIDENT'),
  updateIncident
);
router.put(
  '/:id/status',
  protect,
  authorize('ADMIN', 'DOCTOR'),
  validate({ params: idParams, body: updateIncidentStatusSchema }),
  logActivity('UPDATE_INCIDENT_STATUS'),
  updateIncidentStatus
);

// ✅ NEW: DELETE route
router.delete(
  '/:id',
  protect,
  authorize('ADMIN', 'DOCTOR'),
  validate({ params: idParams }),
  logActivity('DELETE_INCIDENT'),
  deleteIncident
);

export default router;