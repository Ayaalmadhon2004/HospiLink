import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ✅ instance واحد — مع withCredentials!
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // ← ضروري عشان الكوكي يروح!
});

// خدمة تسجيل الدخول
export const login = async (credentials: { email: string; password: string }) => {
  const response = await api.post('/auth/login', credentials);
  
  // ✅ شيلنا localStorage — الكوكي بيجي من Backend!
  // Backend بيحط الكوكي أوتوماتيك
  
  return response.data;
};

// خدمة إنشاء حساب
export const signup = async (userData: any) => {
  const response = await api.post('/auth/signup', userData);
  return response.data;
};

// خدمة تسجيل الخروج
export const logout = async () => {
  await api.post('/auth/logout'); // ← Backend بيمسح الكوكي
  
  // ✅ شيلنا localStorage.removeItem
  // Backend بيمسح الكوكي أوتوماتيك
  
  window.location.href = '/login';
};

// الحصول على بيانات المستخدم الحالي
export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me'); // ← من Backend
    return response.data.user;
  } catch {
    return null;
  }
};

// ✅ جديد: التحقق من حالة تسجيل الدخول
export const isAuthenticated = async () => {
  try {
    await api.get('/auth/me');
    return true;
  } catch {
    return false;
  }
};