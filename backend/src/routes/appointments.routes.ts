// backend/src/routes/appointments.routes.ts
import { Router } from 'express';
import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getTodaySchedule,
  getUpcomingAppointments,
} from '../controllers/appointments.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';

const router = Router();

router.get('/', protect, getAppointments);
router.get('/today', protect, getTodaySchedule);
router.get('/upcoming', protect, getUpcomingAppointments);
router.get('/:id', protect, getAppointmentById);

router.post(
  '/',
  protect,
  authorize('ADMIN', 'DOCTOR', 'NURSE'),
  logActivity('CREATE_APPOINTMENT'),
  createAppointment
);

router.put(
  '/:id',
  protect,
  authorize('ADMIN', 'DOCTOR', 'NURSE'),
  logActivity('UPDATE_APPOINTMENT'),
  updateAppointment
);

router.delete(
  '/:id',
  protect,
  authorize('ADMIN', 'DOCTOR'),
  logActivity('DELETE_APPOINTMENT'),
  deleteAppointment
);

export default router;