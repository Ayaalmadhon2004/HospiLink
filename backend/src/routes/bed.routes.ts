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
import { validate } from '../middlewares/validate.middleware';
import { idParams } from '../validators/common.validator';
import { createBedSchema, updateBedSchema } from '../validators/bed.validator';

const router = Router();

router.get('/', protect, getAllBeds);
router.get('/:id', protect, validate({ params: idParams }), getBedById);
router.post('/', protect, authorize('ADMIN', 'DOCTOR'), validate({ body: createBedSchema }), createBed);
router.put('/:id', protect, authorize('ADMIN', 'DOCTOR'), validate({ params: idParams, body: updateBedSchema }), updateBedStatus);
router.delete('/:id', protect, authorize('ADMIN'), validate({ params: idParams }), deleteBed);

export default router;