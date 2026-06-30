import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, 
});

// ============================================
// GET /api/patients
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
// ============================================
export const getRecentPatients = async () => {
  const response = await api.get('/patients/recent');
  return response.data;
};

// ============================================
// GET /api/patients/:id
// ============================================
export const getPatientById = async (id: string) => {
  const response = await api.get(`/patients/${id}`);
  return response.data;
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
  const response = await api.post('/patients/admit', data);
  return response.data;
};

// ============================================
// PUT /api/patients/:id
// ============================================
export const updatePatient = async (id: string, data: any) => {
  const response = await api.put(`/patients/${id}`, data);
  return response.data;
};

// ============================================
// PUT /api/patients/:id/discharge
// ============================================
export const dischargePatient = async (id: string) => {
  const response = await api.put(`/patients/${id}/discharge`);
  return response.data;
};

// ============================================
// POST /api/patients/:id/reports
// رفع تقرير (PDF, Image)
// ============================================
export const uploadReport = async (file: File, patientId: string) => {
  const formData = new FormData();
  formData.append('reportFile', file);

  const response = await api.post(`/patients/${patientId}/reports`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// ============================================
// GET /api/patients/:id/reports
// جلب تقارير مريض
// ============================================
export const getPatientReports = async (patientId: string) => {
  const response = await api.get(`/patients/${patientId}/reports`);
  return response.data;
};
