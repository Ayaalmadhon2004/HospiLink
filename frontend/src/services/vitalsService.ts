import axios from 'axios';

const API_URL = 'https://hospilink-1bfi.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // ← ✅ الكوكي بيروح أوتوماتيك
});

// Response interceptor للـ 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const recordVitals = async (data: {
  patientId: string;
  heartRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  spO2?: number;
  temperature?: number;
  respiratoryRate?: number;
  notes?: string;
}) => {
  const response = await api.post('/vitals', data);
  return response.data;
};

export const getVitals = async (params?: {
  patientId?: string;
  critical?: boolean;
  limit?: number;
}) => {
  const response = await api.get('/vitals', { params });
  return response.data;
};

export const getCriticalAlerts = async () => {
  const response = await api.get('/vitals/alerts');
  return response.data;
};

export const getVitalsById = async (id: string) => {
  const response = await api.get(`/vitals/${id}`);
  return response.data;
};