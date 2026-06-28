import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // ← ضروري! عشان الكوكي يروح مع كل طلب
});

// ============================================
// GET /api/patients
// كل المرضى مع فلاتر (status, department, search)
// ============================================
export const getPatients = async (params?: { 
  status?: string; 
  department?: string; 
  search?: string 
}) => {
  const response = await api.get('/patients', { params });
  return response.data;
};

// ============================================
// GET /api/patients/recent
// آخر 5 مرضى (للـ Overview Dashboard)
// ============================================
export const getRecentPatients = async () => {
  const response = await api.get('/patients/recent');
  return response.data;
};

// ============================================
// GET /api/patients/:id
// تفاصيل مريض واحد
// ============================================
export const getPatientById = async (id: string) => {
  const response = await api.get(`/patients/${id}`);
  return response.data;
};

// ============================================
// POST /api/patients/admit
// إدخال مريض جديد
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
  const response = await api.post('/patients/admit', data);
  return response.data;
};

// ============================================
// PUT /api/patients/:id
// تحديث بيانات مريض
// ============================================
export const updatePatient = async (id: string, data: any) => {
  const response = await api.put(`/patients/${id}`, data);
  return response.data;
};

// ============================================
// PUT /api/patients/:id/discharge
// تسريح مريض
// ============================================
export const dischargePatient = async (id: string) => {
  const response = await api.put(`/patients/${id}/discharge`);
  return response.data;
};

// ============================================
// POST /api/patients/upload-report
// رفع تقرير (PDF, Image)
// ============================================
export const uploadReport = async (file: File) => {
  const formData = new FormData();
  formData.append('reportFile', file);

  const response = await api.post('/patients/upload-report', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};