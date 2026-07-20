// services/patientService.ts
import { apiFetch, apiGet, apiPost, apiPut } from './api';

export const getPatients = async (params?: any) => {
  const queryString = params 
    ? '?' + new URLSearchParams(params as Record<string, string>).toString() 
    : '';

  return await apiGet(`/patients${queryString}`);
};

export const getRecentPatients = async () => {
  return await apiGet('/patients/recent');
};

export const getPatientById = async (id: string) => {
  return await apiGet(`/patients/${id}`);
};

export const admitPatient = async (data: any) => {
  return await apiPost('/patients/admit', data);
};

export const updatePatient = async (id: string, data: any) => {
  return await apiPut(`/patients/${id}`, data);
};

export const dischargePatient = async (id: string) => {
  return await apiPut(`/patients/${id}/discharge`);
};

export const uploadReport = async (file: File, patientId: string) => {
  const formData = new FormData();
  formData.append('reportFile', file);
  return await apiFetch(`/patients/${patientId}/reports`, {
    method: 'POST',
    body: formData,
  });
};

export const getPatientReports = async (patientId: string) => {
  return await apiGet(`/patients/${patientId}/reports`);
};

export const getAvailableBeds = async (department?: string) => {
  const params = department ? `?department=${encodeURIComponent(department)}` : '';
  return await apiGet(`/patients/beds/available${params}`);
};