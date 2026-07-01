// services/authService.ts
import { apiPost, apiGet } from './api';

export const login = async (credentials: { email: string; password: string }) => {
  const res = await apiPost('/auth/login', credentials);
  const data = await res.json();
  
  if (data.success && data.token) {
    localStorage.setItem('token', data.token);
  }
  
  return data;
};

export const signup = async (userData: any) => {
  const res = await apiPost('/auth/signup', userData);
  return res.json();
};

export const logout = async () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
};

export const getCurrentUser = async () => {
  try {
    const res = await apiGet('/auth/me');
    const data = await res.json();
    return data.user;
  } catch {
    return null;
  }
};

export const isAuthenticated = async () => {
  try {
    await apiGet('/auth/me');
    return true;
  } catch {
    return false;
  }
};