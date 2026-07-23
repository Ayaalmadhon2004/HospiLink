// frontend/src/services/staffService.ts
import { apiGet, apiPost, apiPut, apiDelete } from './api';

export const getStaff = (params?: { department?: string; role?: string }) => {
  const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
  return apiGet(`/staff${query}`);
};

export const getStaffById = (id: string) => 
  apiGet(`/staff/${id}`);

// ─── NEW: Staff CRUD ───────────────────────────────────────────────
export const createStaff = (data: { name: string; email: string; role: string; department: string; phone?: string; status?: string }) =>
  apiPost('/staff', data);

export const updateStaff = (id: string, data: Partial<{ name: string; email: string; role: string; department: string; phone: string; status: string }>) =>
  apiPut(`/staff/${id}`, data);

export const deleteStaff = (id: string) =>
  apiDelete(`/staff/${id}`);

// ─── Shifts ────────────────────────────────────────────────────────
export const getShifts = (params?: { department?: string; staffId?: string; date?: string }) => {
  const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
  return apiGet(`/staff/shifts${query}`);
};

export const getShiftTimeline = (date?: string) => {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiGet(`/staff/shifts/timeline${query}`);
};

export const createShift = (data: any) => 
  apiPost('/staff/shifts', data);

export const updateShift = (id: string, data: any) => 
  apiPut(`/staff/shifts/${id}`, data);

export const deleteShift = (id: string) => 
  apiDelete(`/staff/shifts/${id}`);