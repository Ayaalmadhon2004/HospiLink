import { Router } from 'express';
import { admitPatient } from '../controllers/patient.controller';

const router = Router();

// مسار لإدخال مريض جديد
router.post('/admit', admitPatient);

export default router;