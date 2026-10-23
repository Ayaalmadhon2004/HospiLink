// frontend/src/services/authService.ts
import { apiPost, apiGet } from './api';

// ============================================
// LOGIN
// ============================================
export interface LoginResponse {
  success?: boolean;
  message?: string;
  user?: { id: string };
  // Set instead of `user` when the account has 2FA: finish with verifyTwoFactor().
  twoFactorRequired?: boolean;
  challengeToken?: string;
}

export const login = async (credentials: { email: string; password: string; rememberMe?: boolean }) => {
  const data = await apiPost<LoginResponse>('/auth/login', credentials);

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

// ============================================
// PASSWORD RESET / EMAIL VERIFICATION
// ============================================
export const forgotPassword = (email: string) => apiPost('/auth/forgot-password', { email });

export const resetPassword = (token: string, password: string) =>
  apiPost('/auth/reset-password', { token, password });

export const verifyEmail = (token: string) => apiPost('/auth/verify-email', { token });

export const resendVerification = (email: string) => apiPost('/auth/resend-verification', { email });

// ============================================
// TWO-FACTOR AUTHENTICATION
// ============================================
export type SecondFactor = { code: string } | { recoveryCode: string };

export const verifyTwoFactor = (challengeToken: string, factor: SecondFactor) =>
  apiPost<LoginResponse>('/auth/2fa/login', { challengeToken, ...factor });

export const setupTwoFactor = () =>
  apiPost<{ data: { secret: string; otpauthUrl: string } }>('/auth/2fa/setup');

export const enableTwoFactor = (code: string) =>
  apiPost<{ data: { recoveryCodes: string[] } }>('/auth/2fa/enable', { code });

export const disableTwoFactor = (password: string, factor: SecondFactor) =>
  apiPost('/auth/2fa/disable', { password, ...factor });
