// frontend/src/services/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers();
  
  // ✅ Content-Type للـ JSON
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // دمج headers من options
  if (options.headers) {
    const existingHeaders = new Headers(options.headers);
    existingHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
    credentials: 'include', // ← ✅ الكوكي بيروح أوتوماتيك
  });

  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${res.status}`);
  }

  return res;
};

export const apiGet = async (url: string) => {
  const res = await apiFetch(url, { method: 'GET' });
  return res.json();
};

export const apiPost = async (url: string, body?: any) => {
  const res = await apiFetch(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

export const apiPut = async (url: string, body?: any) => {
  const res = await apiFetch(url, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
};

export const apiDelete = async (url: string) => {
  const res = await apiFetch(url, { method: 'DELETE' });
  return res.json();
};