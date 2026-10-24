// frontend/src/services/api.ts
import axios from 'axios';
import type { ApiResponse, QueryParams } from '../types/api';
import { toApiError } from './normalizeApiError';
const API_BASE = import.meta.env.VITE_API_URL ?? 'https://hospilink-1bfi.onrender.com/api';

// ============================================
// CORE AXIOS INSTANCE
// ============================================

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 30000, // ✅ 30 ثانية — ضروري لـ Render cold starts
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// REQUEST INTERCEPTOR — Hybrid (Cookies + JWT)
// ============================================

api.interceptors.request.use(
  (config) => {
    // Auth relies on the httpOnly cookie (withCredentials) — no token in JS-accessible storage
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// RESPONSE INTERCEPTOR — NO hard redirect
// ============================================

api.interceptors.response.use((response) => response, (error: unknown) => Promise.reject(toApiError(error)));

// ============================================
// MODERN HTTP METHODS
// ============================================

export const apiGet = async <T = ApiResponse>(url: string, params?: QueryParams): Promise<T> => {
  const response = await api.get(url, { params });
  return response.data;
};

export const apiPost = async <T = ApiResponse>(url: string, body?: unknown): Promise<T> => {
  const response = await api.post(url, body);
  return response.data;
};

export const apiPut = async <T = ApiResponse>(url: string, body?: unknown): Promise<T> => {
  const response = await api.put(url, body);
  return response.data;
};

export const apiPatch = async <T = ApiResponse>(url: string, body?: unknown): Promise<T> => {
  const response = await api.patch(url, body);
  return response.data;
};

export const apiDelete = async <T = ApiResponse>(url: string): Promise<T> => {
  const response = await api.delete(url);
  return response.data;
};

// ============================================
// FILE UPLOAD METHOD
// ============================================

export const apiUpload = async <T = ApiResponse>(url: string, formData: FormData): Promise<T> => {
  const response = await api.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export default api;