import { Router } from 'express';
import { 
  admitPatient, 
  uploadReport, 
  getRecentPatients,
  getPatients,        // ← NEW
  getPatientById,     // ← NEW
  updatePatient,      // ← NEW
  dischargePatient    // ← NEW
} from '../controllers/patient.controller';
import { protect, authorize } from '../middlewares/auth.middleware';
import { logActivity } from '../middlewares/audit.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

// ============================================
// POST /api/patients/admit
// إدخال مريض جديد - بس DOCTOR أو NURSE
// ============================================
router.post(
  '/admit', 
  protect, 
  authorize('DOCTOR', 'NURSE','ADMIN'), 
  logActivity('ADMIT_PATIENT'), 
  admitPatient
);

// ============================================
// POST /api/patients/upload-report
// رفع تقرير - أي مسجل دخول
// ============================================
router.post(
  '/upload-report', 
  protect, 
  upload.single('reportFile'), 
  logActivity('UPLOAD_REPORT'),
  uploadReport
);

// ============================================
// GET /api/patients/recent
// آخر 5 مرضى - DOCTOR, NURSE, ADMIN
// ============================================
router.get(
  '/recent', 
  protect, 
  authorize('DOCTOR', 'NURSE', 'ADMIN'), 
  getRecentPatients
);

// ============================================
// NEW: GET /api/patients
// كل المرضى مع فلاتر - أي مسجل دخول
// ============================================
router.get(
  '/',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN', 'DISPATCHER'),
  getPatients
);

// ============================================
// NEW: GET /api/patients/:id
// تفاصيل مريض واحد
// ============================================
router.get(
  '/:id',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  getPatientById
);

// ============================================
// NEW: PUT /api/patients/:id
// تحديث بيانات مريض
// ============================================
router.put(
  '/:id',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  logActivity('UPDATE_PATIENT'),
  updatePatient
);

// ============================================
// NEW: PUT /api/patients/:id/discharge
// تسريح مريض
// ============================================
router.put(
  '/:id/discharge',
  protect,
  authorize('DOCTOR', 'ADMIN'),
  logActivity('DISCHARGE_PATIENT'),
  dischargePatient
);

export default router;