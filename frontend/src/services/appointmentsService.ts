// frontend/src/services/appointmentsService.ts
import { apiGet, apiPost, apiPut, apiDelete } from './api';

export interface Appointment {
  id: string;
  scheduledAt: string;
  type: string;
  status: string;
  department: string;
  room?: string;
  duration: number;
  notes?: string;
  patient: {
    id: string;
    name: string;
    patientCode: string;
  };
  doctor: {
    id: string;
    name: string;
    role: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAppointmentData {
  patientId?: string;      // ✅ NEW: Existing patient ID
  patientName?: string;
  patientCode?: string;
  doctorId: string;
  scheduledAt: string;
  type: string;
  status?: string;
  department?: string;
  room?: string;
  notes?: string;
  duration?: number;
}

export const getAppointments = (params?: Record<string, any>) => 
  apiGet('/appointments', params);

export const getTodaySchedule = () => 
  apiGet('/appointments/today');

export const getUpcomingAppointments = () => 
  apiGet('/appointments/upcoming');

export const getAppointmentById = (id: string) => 
  apiGet(`/appointments/${id}`);

export const createAppointment = (data: CreateAppointmentData) => 
  apiPost('/appointments', data);

export const updateAppointment = (id: string, data: Partial<CreateAppointmentData>) => 
  apiPut(`/appointments/${id}`, data);

export const deleteAppointment = (id: string) => 
  apiDelete(`/appointments/${id}`);