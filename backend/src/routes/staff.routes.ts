// backend/src/routes/staff.routes.ts
import { Router } from 'express';
import {
  getStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getShiftTimeline,
} from '../controllers/staff.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';

const router = Router();

// ─── Staff Routes ──────────────────────────────────────────────────────

// GET /api/staff - List all staff
router.get('/', protect, getStaff);

// GET /api/staff/:id - Get single staff
router.get('/:id', protect, getStaffById);

// POST /api/staff - Create staff (ADMIN only)
router.post('/', protect, authorize('ADMIN'), logActivity('CREATE_STAFF'), createStaff);

// PUT /api/staff/:id - Update staff (ADMIN only)
router.put('/:id', protect, authorize('ADMIN'), logActivity('UPDATE_STAFF'), updateStaff);

// DELETE /api/staff/:id - Delete staff (ADMIN only)
router.delete('/:id', protect, authorize('ADMIN'), logActivity('DELETE_STAFF'), deleteStaff);

// ─── Shift Routes ──────────────────────────────────────────────────────

// GET /api/staff/shifts - List shifts
router.get('/shifts', protect, getShifts);

// GET /api/staff/shifts/timeline - 24h timeline
router.get('/shifts/timeline', protect, getShiftTimeline);

// POST /api/staff/shifts - Create shift
router.post('/shifts', protect, authorize('ADMIN', 'DOCTOR'), logActivity('CREATE_SHIFT'), createShift);

// PUT /api/staff/shifts/:id - Update shift
router.put('/shifts/:id', protect, authorize('ADMIN', 'DOCTOR'), logActivity('UPDATE_SHIFT'), updateShift);

// DELETE /api/staff/shifts/:id - Delete shift
router.delete('/shifts/:id', protect, authorize('ADMIN'), logActivity('DELETE_SHIFT'), deleteShift);

export default router;