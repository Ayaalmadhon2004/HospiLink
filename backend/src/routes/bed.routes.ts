// src/routes/bed.routes.ts
import { Router } from 'express';
import {
  getAllBeds,
  getBedById,
  createBed,
  updateBedStatus,
  deleteBed,
} from '../controllers/bed.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', protect, getAllBeds);
router.get('/:id', protect, getBedById);
router.post('/', protect, authorize('ADMIN', 'DOCTOR'), createBed);
router.put('/:id', protect, authorize('ADMIN', 'DOCTOR'), updateBedStatus);
router.delete('/:id', protect, authorize('ADMIN'), deleteBed);

export default router;