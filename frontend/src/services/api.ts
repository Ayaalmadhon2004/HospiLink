// services/api.ts
const API_BASE = '/api';

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token');
  
  // ابدأ بـ Headers object
  const headers = new Headers();
  
  // أضف token لو موجود
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // دمج headers من options (هذي الأهم!)
  if (options.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,  // ← الحين Headers object صحيح
    credentials: 'include',
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${res.status}`);
  }

  return res;
};

export const apiGet = (url: string) => apiFetch(url, { method: 'GET' });

export const apiPost = (url: string, body?: any) => 
  apiFetch(url, { 
    method: 'POST', 
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const apiPut = (url: string, body?: any) => 
  apiFetch(url, { 
    method: 'PUT', 
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
    },
  });

export const apiDelete = (url: string) => 
  apiFetch(url, { method: 'DELETE' });