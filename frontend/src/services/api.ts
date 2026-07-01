const API_BASE = '/api';

export const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    console.error('Unauthorized - redirecting to login');
    // window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return res;
};