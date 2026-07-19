import { Router } from 'express';
import { 
  admitPatient, 
  uploadReport, 
  getRecentPatients,
  getPatients,        
  getPatientById,     
  updatePatient,      
  dischargePatient,    
  getPatientReports,
  getAvailableBeds    // ← NEW
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
  '/:id/reports', 
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
// ⚠️ MUST be BEFORE /:id route!
// GET /api/patients/beds/available
// الأسرة المتاحة للحجز
// ============================================
router.get(
  '/beds/available',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  getAvailableBeds
);

// ============================================
// GET /api/patients
// كل المرضى مع فلاتر + Pagination
// ============================================
router.get(
  '/',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN', 'DISPATCHER'),
  getPatients
);

// ============================================
// GET /api/patients/:id
// تفاصيل مريض واحد
// ⚠️ This matches ANY string after / including "beds"!
// So /beds/available MUST be defined above this!
// ============================================
router.get(
  '/:id',
  protect,
  authorize('DOCTOR', 'NURSE', 'ADMIN'),
  getPatientById
);

router.get('/:id/reports', getPatientReports);


// ============================================
// PUT /api/patients/:id
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
// PUT /api/patients/:id/discharge
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