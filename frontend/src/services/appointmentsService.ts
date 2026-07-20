// frontend/src/services/appointmentsService.ts
import { apiGet, apiPost, apiPut, apiDelete } from './api';

export const getAppointments = (params?: {
  date?: string;
  doctorId?: string;
  patientId?: string;
  status?: string;
  type?: string;
  department?: string;
}) => {
  const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
  return apiGet(`/appointments${query}`);
};

export const getTodaySchedule = () => apiGet('/appointments/today');

export const getUpcomingAppointments = () => apiGet('/appointments/upcoming');

export const getAppointmentById = (id: string) => apiGet(`/appointments/${id}`);

export const createAppointment = (data: any) => apiPost('/appointments', data);

export const updateAppointment = (id: string, data: any) => apiPut(`/appointments/${id}`, data);

export const cancelAppointment = (id: string) => apiDelete(`/appointments/${id}`);