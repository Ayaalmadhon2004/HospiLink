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
import { validate } from '../middlewares/validate.middleware';
import { idParams } from '../validators/common.validator';
import { createAppointmentSchema, updateAppointmentSchema, appointmentQuerySchema } from '../validators/appointment.validator';

const router = Router();

router.get('/', protect, validate({ query: appointmentQuerySchema }), getAppointments);
router.get('/today', protect, getTodaySchedule);
router.get('/upcoming', protect, getUpcomingAppointments);
router.get('/:id', protect, validate({ params: idParams }), getAppointmentById);

router.post(
  '/',
  protect,
  authorize('ADMIN', 'DOCTOR', 'NURSE'),
  validate({ body: createAppointmentSchema }),
  logActivity('CREATE_APPOINTMENT'),
  createAppointment
);

router.put(
  '/:id',
  protect,
  authorize('ADMIN', 'DOCTOR', 'NURSE'),
  validate({ params: idParams, body: updateAppointmentSchema }),
  logActivity('UPDATE_APPOINTMENT'),
  updateAppointment
);

router.delete(
  '/:id',
  protect,
  authorize('ADMIN', 'DOCTOR'),
  validate({ params: idParams }),
  logActivity('DELETE_APPOINTMENT'),
  deleteAppointment
);

export default router;