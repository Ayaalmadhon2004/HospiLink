// backend/src/routes/incidents.routes.ts
import { Router } from 'express';
import {
  getIncidents,
  getActiveIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  updateIncidentStatus,
} from '../controllers/incidents.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';

const router = Router();

router.get('/', protect, getIncidents);
router.get('/active', protect, getActiveIncidents);
router.get('/:id', protect, getIncidentById);
router.post('/', protect, authorize('ADMIN', 'DOCTOR', 'NURSE'), logActivity('CREATE_INCIDENT'), createIncident);
router.put('/:id', protect, authorize('ADMIN', 'DOCTOR'), logActivity('UPDATE_INCIDENT'), updateIncident);
router.put('/:id/status', protect, authorize('ADMIN', 'DOCTOR'), logActivity('UPDATE_INCIDENT_STATUS'), updateIncidentStatus);

export default router;