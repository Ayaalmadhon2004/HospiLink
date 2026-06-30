import { Router } from 'express';
import { getAllWards, getWardById } from '../controllers/ward.controller';
import { protect, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', protect, getAllWards);
router.get('/:id', protect, getWardById);

export default router;