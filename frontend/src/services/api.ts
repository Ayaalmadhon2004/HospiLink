// frontend/src/services/api.ts
import axios from 'axios';
import i18n from '../i18n';
import type { ApiResponse, QueryParams } from '../types/api';
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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      return Promise.reject(new Error(i18n.t('errors.forbidden')));
    }

    if (error.response?.status >= 500) {
      return Promise.reject(new Error(i18n.t('errors.server')));
    }

    const message = error.response?.data?.message || error.response?.data?.error || error.message;
    return Promise.reject(new Error(message));
  }
);

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

// ============================================
// LEGACY COMPATIBILITY
// ============================================
// ليش الفتش فيها كل المثودز مش بس get ? 
export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const method = (options.method || 'GET').toUpperCase();

  try {
    let response;

    switch (method) {
      case 'GET':
        response = await api.get(url);
        break;
      case 'POST':
        response = await api.post(url, options.body ? JSON.parse(options.body as string) : undefined);
        break;
      case 'PUT':
        response = await api.put(url, options.body ? JSON.parse(options.body as string) : undefined);
        break;
      case 'PATCH':
        response = await api.patch(url, options.body ? JSON.parse(options.body as string) : undefined);
        break;
      case 'DELETE':
        response = await api.delete(url);
        break;
      default:
        throw new Error(`Unsupported method: ${method}`);
    }

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      json: async () => response.data,
      text: async () => JSON.stringify(response.data),
    };
  } catch (caught: unknown) {
    const error = caught as { response?: { status?: number; data?: unknown }; message?: string };
    return {
      ok: false,
      status: error.response?.status || 500,
      statusText: error.message,
      headers: new Headers(),
      json: async () => error.response?.data || { error: error.message },
      text: async () => error.message,
    };
  }
};

export default api;