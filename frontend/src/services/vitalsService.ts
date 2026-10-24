// frontend/src/services/vitalsService.ts
import { apiGet, apiPost } from './api';
import type { ApiResponse } from '../types/api';
import type { RecordVitalsInput, VitalAlert, Vitals } from '../types/vitals';

export const recordVitals = async (data: RecordVitalsInput) => {
  return apiPost<ApiResponse<Vitals>>('/vitals', data);
};

export const getVitals = async (params?: {
  patientId?: string;
  critical?: boolean;
  limit?: number;
}) => {
  return apiGet<ApiResponse<Vitals[]>>('/vitals', params);
};

export const getCriticalAlerts = async () => {
  return apiGet<ApiResponse<VitalAlert[]>>('/vitals/alerts');
};

export const getVitalsById = async (id: string) => {
  return apiGet<ApiResponse<Vitals>>(`/vitals/${id}`);
};
