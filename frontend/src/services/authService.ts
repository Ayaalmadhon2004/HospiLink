// frontend/src/services/authService.ts
import { apiPost, apiGet } from './api';

// ============================================
// LOGIN
// ============================================
export const login = async (credentials: { email: string; password: string; rememberMe?: boolean }) => {
  const data = await apiPost('/auth/login', credentials);

  // الـ token بينحفظ بكوكي httpOnly من السيرفر — ما منخزنه بالـ localStorage
  return data;
};

// ============================================
// SIGNUP
// ============================================
// role / hospitalId are intentionally not accepted: the server assigns them.
export const signup = async (userData: {
  name: string;
  email: string;
  password: string;
  department: string;
  shift: string;
  hospitalCode: string;
}) => {
  const data = await apiPost('/auth/signup', userData);

  return data;
};

// ============================================
// LOGOUT
// ============================================
export const logout = async () => {
  try {
    await apiPost('/auth/logout');
  } catch {
    // Logout is best-effort: the redirect below happens regardless
  }
  // الكوكي بيتمسح من السيرفر عبر /auth/logout
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