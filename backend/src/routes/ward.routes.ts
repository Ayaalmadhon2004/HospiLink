// src/routes/ward.routes.ts
import { Router } from 'express';
import { getAllWards, createWard, updateWard, deleteWard } from '../controllers/ward.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { idParams } from '../validators/common.validator';
import { createWardSchema, updateWardSchema } from '../validators/ward.validator';

const router = Router();

router.get('/', protect, getAllWards);
router.post('/', protect, authorize('ADMIN'), validate({ body: createWardSchema }), logActivity('CREATE_WARD'), createWard);
router.put('/:id', protect, authorize('ADMIN'), validate({ params: idParams, body: updateWardSchema }), logActivity('UPDATE_WARD'), updateWard);
router.delete('/:id', protect, authorize('ADMIN'), validate({ params: idParams }), logActivity('DELETE_WARD'), deleteWard);

export default router;
