// frontend/src/services/api.ts

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ============================================
// CORE FETCH WRAPPER
// ============================================

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers();

  // ✅ Content-Type للـ JSON body
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

  // ✅ 401 → redirect للـ login
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  // ✅ 304 Not Modified → treat as success (cached response)
  if (res.status === 304) {
    return {};
  }

  // ❌ أي error تاني
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    if (errorData?.message) {
      throw new Error(errorData.message);
    }
    const errorText = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(errorText || `HTTP ${res.status}`);
  }

  // ✅ parse response
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }

  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return text || {};
  }
};

// ============================================
// HTTP METHODS
// ============================================
//
export const apiGet = (url: string) => 
  apiFetch(url, { method: 'GET' });

export const apiPost = (url: string, body?: any) => 
  apiFetch(url, { 
    method: 'POST', 
    body: body ? JSON.stringify(body) : undefined,
  });

export const apiPut = (url: string, body?: any) => 
  apiFetch(url, { 
    method: 'PUT', 
    body: body ? JSON.stringify(body) : undefined,
  });

export const apiDelete = (url: string) => 
  apiFetch(url, { method: 'DELETE' });

export const apiPatch = (url: string, body?: any) => 
  apiFetch(url, { 
    method: 'PATCH', 
    body: body ? JSON.stringify(body) : undefined,
  });