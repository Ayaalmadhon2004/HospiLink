import { Router } from 'express';
import {
  getAllBeds,
  getBedById,
  createBed,
  updateBedStatus,
  deleteBed
} from '../controllers/bed.controller';

const router = Router();

router.get('/', getAllBeds);
router.get('/:id', getBedById);
router.post('/', createBed);
router.put('/:id', updateBedStatus);
router.delete('/:id', deleteBed);

export default router;