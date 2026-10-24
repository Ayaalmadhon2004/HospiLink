// frontend/src/services/staffService.ts
import { apiGet, apiPost, apiPut, apiDelete } from './api';
import { toQueryString, type ApiResponse } from '../types/api';
import type { ShiftInput, StaffMember } from '../types/staff';

export const getStaff = (params?: { department?: string; role?: string }) => {
  return apiGet<ApiResponse<StaffMember[]>>(`/staff${toQueryString(params)}`);
};

export const getStaffById = (id: string) => 
  apiGet(`/staff/${id}`);

// ─── NEW: Staff CRUD ───────────────────────────────────────────────
export const createStaff = (data: { name: string; email: string; role: string; department: string; phone?: string; status?: string; loginRole?: string }) =>
  apiPost('/staff', data);

export const updateStaff = (id: string, data: Partial<{ name: string; email: string; role: string; department: string; phone: string; status: string }>) =>
  apiPut(`/staff/${id}`, data);

export const deleteStaff = (id: string) =>
  apiDelete(`/staff/${id}`);

// ─── Shifts ────────────────────────────────────────────────────────
export const getShifts = (params?: { department?: string; staffId?: string; date?: string }) => {
  return apiGet(`/staff/shifts${toQueryString(params)}`);
};

export const getShiftTimeline = (date?: string) => {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiGet(`/staff/shifts/timeline${query}`);
};

export const createShift = (data: ShiftInput) => 
  apiPost('/staff/shifts', data);

export const updateShift = (id: string, data: ShiftInput) => 
  apiPut(`/staff/shifts/${id}`, data);

export const deleteShift = (id: string) => 
  apiDelete(`/staff/shifts/${id}`);