import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,  // ← ضروري! عشان الكوكي يروح مع كل طلب
});

// ✅ شيلنا الـ interceptor — الكوكي بيروح أوتوماتيك!

export const getRecentPatients = async () => {
  const response = await api.get('/patients/recent');
  return response.data;
};

export const admitPatient = async (data: any) => {
  const response = await api.post('/patients/admit', data);
  return response.data;
};