// frontend/src/services/api.ts
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

// ============================================
// CORE AXIOS INSTANCE
// ============================================

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// REQUEST INTERCEPTOR — Hybrid (Cookies + JWT)
// ============================================

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    || localStorage.getItem('accessToken')
    || localStorage.getItem('authToken');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// RESPONSE INTERCEPTOR
// ============================================

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('authToken');
      window.location.href = '/login';
      return Promise.reject(new Error('Session expired. Please login again.'));
    }

    if (error.response?.status === 403) {
      return Promise.reject(new Error('You do not have permission to perform this action.'));
    }

    if (error.response?.status >= 500) {
      return Promise.reject(new Error('Server error. Please try again later.'));
    }

    const message = error.response?.data?.message || error.response?.data?.error || error.message;
    return Promise.reject(new Error(message));
  }
);

// ============================================
// MODERN HTTP METHODS (return data directly)
// ============================================

export const apiGet = async <T = any>(url: string, params?: Record<string, any>): Promise<T> => {
  const response = await api.get(url, { params });
  return response.data;
};

export const apiPost = async <T = any>(url: string, body?: any): Promise<T> => {
  const response = await api.post(url, body);
  return response.data;
};

export const apiPut = async <T = any>(url: string, body?: any): Promise<T> => {
  const response = await api.put(url, body);
  return response.data;
};

export const apiPatch = async <T = any>(url: string, body?: any): Promise<T> => {
  const response = await api.patch(url, body);
  return response.data;
};

export const apiDelete = async <T = any>(url: string): Promise<T> => {
  const response = await api.delete(url);
  return response.data;
};

// ============================================
// FILE UPLOAD METHOD
// ============================================

export const apiUpload = async <T = any>(url: string, formData: FormData): Promise<T> => {
  const response = await api.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// ============================================
// LEGACY COMPATIBILITY (for old code using fetch-style)
// ============================================

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
  } catch (error: any) {
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