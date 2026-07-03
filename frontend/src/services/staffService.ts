// frontend/src/services/staffService.ts
import api from './api'; // axios instance

export const getStaff = (params?: { department?: string; role?: string }) => 
  api.get('/staff', { params });

export const getStaffById = (id: string) => 
  api.get(`/staff/${id}`);

export const getShifts = (params?: { department?: string; staffId?: string; date?: string }) => 
  api.get('/staff/shifts', { params });

export const getShiftTimeline = (date?: string) => 
  api.get('/staff/shifts/timeline', { params: { date } });

export const createShift = (data: any) => 
  api.post('/staff/shifts', data);

export const updateShift = (id: string, data: any) => 
  api.put(`/staff/shifts/${id}`, data);

export const deleteShift = (id: string) => 
  api.delete(`/staff/shifts/${id}`);