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

// ─── Appointments Routes ─────────────────────────────────────────────────

// GET /api/appointments - List all (with filters: date, doctor, patient, status, type)
router.get('/', protect, getAppointments);

// GET /api/appointments/today - Today's schedule
router.get('/today', protect, getTodaySchedule);

// GET /api/appointments/upcoming - Upcoming appointments
router.get('/upcoming', protect, getUpcomingAppointments);

// GET /api/appointments/:id - Single appointment
router.get('/:id', protect, getAppointmentById);

// POST /api/appointments - Create (DOCTOR, ADMIN, NURSE)
router.post('/', protect, authorize('ADMIN', 'DOCTOR', 'NURSE'), logActivity('CREATE_APPOINTMENT'), createAppointment);

// PUT /api/appointments/:id - Update
router.put('/:id', protect, authorize('ADMIN', 'DOCTOR', 'NURSE'), logActivity('UPDATE_APPOINTMENT'), updateAppointment);

// DELETE /api/appointments/:id - Cancel/Delete
router.delete('/:id', protect, authorize('ADMIN', 'DOCTOR'), logActivity('DELETE_APPOINTMENT'), deleteAppointment);

export default router;