// frontend/src/services/authService.ts
import { apiPost, apiGet } from './api';

// ============================================
// LOGIN
// ============================================
export const login = async (credentials: { email: string; password: string }) => {
  const data = await apiPost('/auth/login', credentials);

  // ✅ خزن token في localStorage
  if (data.token) {
    localStorage.setItem('token', data.token);
  }

  return data;
};

// ============================================
// SIGNUP
// ============================================
export const signup = async (userData: any) => {
  const data = await apiPost('/auth/signup', userData);

  // ✅ خزن token في localStorage
  if (data.token) {
    localStorage.setItem('token', data.token);
  }

  return data;
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
  // ✅ امسح token من localStorage
  localStorage.removeItem('token');
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