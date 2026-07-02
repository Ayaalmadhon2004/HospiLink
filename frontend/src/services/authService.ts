// frontend/src/services/authService.ts
import { apiPost, apiGet } from './api';

// ============================================
// LOGIN
// ============================================
export const login = async (credentials: { email: string; password: string }) => {
  // ✅ apiPost بيرجّع JSON مباشرة — ما نحتاج res.json()!
  const data = await apiPost('/auth/login', credentials);
  
  // ✅ الكوكيز بتتخزن أوتوماتيك — ما نحتاج localStorage!
  // (الـ backend بيحط الكوكي في الـ response)
  
  return data;
};

// ============================================
// SIGNUP
// ============================================
export const signup = async (userData: any) => {
  return apiPost('/auth/signup', userData);
};

// ============================================
// LOGOUT
// ============================================
export const logout = async () => {
  try {
    await apiPost('/auth/logout');
  } catch (err) {
    console.error('Logout error:', err);
  }
  // ✅ redirect للـ login
  window.location.href = '/login';
};

// ============================================
// GET CURRENT USER
// ============================================
export const getCurrentUser = async () => {
  try {
    const data = await apiGet('/auth/me');
    return data.user || null;
  } catch {
    return null;
  }
};

// ============================================
// CHECK AUTH
// ============================================
export const isAuthenticated = async () => {
  try {
    const data = await apiGet('/auth/me');
    return !!data.user;
  } catch {
    return false;
  }
};