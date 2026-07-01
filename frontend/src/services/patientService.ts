// services/patientService.ts
import { apiFetch, apiGet, apiPost, apiPut } from './api';

// ============================================
// GET /api/patients
// ============================================
export const getPatients = async (params?: { 
  status?: string; 
  department?: string; 
  search?: string 
}) => {
  const queryString = params 
    ? '?' + new URLSearchParams(params as Record<string, string>).toString() 
    : '';
  
  const res = await apiGet(`/patients${queryString}`);
  return res.json();
};

// ============================================
// GET /api/patients/recent
// ============================================
export const getRecentPatients = async () => {
  const res = await apiGet('/patients/recent');
  return res.json();
};

// ============================================
// GET /api/patients/:id
// ============================================
export const getPatientById = async (id: string) => {
  const res = await apiGet(`/patients/${id}`);
  return res.json();
};

// ============================================
// POST /api/patients/admit
// ============================================
export const admitPatient = async (data: {
  name: string;
  age: number;
  gender: string;
  department: string;
  diagnosis: string;
  doctorId?: string;
  bedId?: string;
  hospitalId: string;
}) => {
  const res = await apiPost('/patients/admit', data);
  return res.json();
};

// ============================================
// PUT /api/patients/:id
// ============================================
export const updatePatient = async (id: string, data: any) => {
  const res = await apiPut(`/patients/${id}`, data);
  return res.json();
};

// ============================================
// PUT /api/patients/:id/discharge
// ============================================
export const dischargePatient = async (id: string) => {
  const res = await apiPut(`/patients/${id}/discharge`);
  return res.json();
};

// ============================================
// POST /api/patients/:id/reports
// رفع تقرير (PDF, Image) - FormData
// ============================================
export const uploadReport = async (file: File, patientId: string) => {
  const formData = new FormData();
  formData.append('reportFile', file);

  const res = await apiFetch(`/patients/${patientId}/reports`, {
    method: 'POST',
    body: formData,
    // ❌ لا تضيف Content-Type هنا! Browser بيضيفه تلقائياً مع boundary
  });
  
  return res.json();
};

// ============================================
// GET /api/patients/:id/reports
// جلب تقارير مريض
// ============================================
export const getPatientReports = async (patientId: string) => {
  const res = await apiGet(`/patients/${patientId}/reports`);
  return res.json();
};