import axios from 'axios';

// استيراد الـ Base URL من الإعدادات
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// إنشاء instance خاص بالـ Auth (لأنه لا يحتاج Token في البداية)
const authApi = axios.create({
  baseURL: `${API_URL}/auth`,
});

// خدمة تسجيل الدخول
export const login = async (credentials: { email: string; password: string }) => {
  const response = await authApi.post('/login', credentials);
  
  if (response.data.token) {
    // تخزين الـ Token وبيانات المستخدم
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }
  
  return response.data;
};

// خدمة إنشاء حساب
export const signup = async (userData: any) => {
  const response = await authApi.post('/signup', userData);
  return response.data;
};

// خدمة تسجيل الخروج
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login'; // إعادة توجيه المستخدم
};

// الحصول على بيانات المستخدم الحالي المخزنة
export const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};