// frontend/src/services/vitalsService.ts
import { apiGet, apiPost } from './api';   // ← بدل axios، استخدم الـ instance المشترك

export const recordVitals = async (data: {
  patientId: string;
  heartRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  spO2?: number;
  temperature?: number;
  respiratoryRate?: number;
  notes?: string;
}) => {
  return apiPost('/vitals', data);
};

export const getVitals = async (params?: {
  patientId?: string;
  critical?: boolean;
  limit?: number;
}) => {
  return apiGet('/vitals', params);
};

export const getCriticalAlerts = async () => {
  return apiGet('/vitals/alerts');
};

export const getVitalsById = async (id: string) => {
  return apiGet(`/vitals/${id}`);
};