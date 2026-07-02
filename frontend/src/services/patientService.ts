// services/patientService.ts
import { apiFetch, apiGet, apiPost, apiPut } from './api';

export const getPatients = async (params?: any) => {
  const queryString = params 
    ? '?' + new URLSearchParams(params as Record<string, string>).toString() 
    : '';
  
  return await apiGet(`/patients${queryString}`); // إزالة .json()
};

export const getRecentPatients = async () => {
  return await apiGet('/patients/recent'); // إزالة .json()
};

export const getPatientById = async (id: string) => {
  return await apiGet(`/patients/${id}`); // إزالة .json()
};

export const admitPatient = async (data: any) => {
  return await apiPost('/patients/admit', data); // إزالة .json()
};

export const updatePatient = async (id: string, data: any) => {
  return await apiPut(`/patients/${id}`, data); // إزالة .json()
};

export const dischargePatient = async (id: string) => {
  return await apiPut(`/patients/${id}/discharge`); // إزالة .json()
};

export const uploadReport = async (file: File, patientId: string) => {
  const formData = new FormData();
  formData.append('reportFile', file);
  return await apiFetch(`/patients/${patientId}/reports`, {
    method: 'POST',
    body: formData,
  }); // إزالة .json()
};

export const getPatientReports = async (patientId: string) => {
  return await apiGet(`/patients/${patientId}/reports`); // إزالة .json()
};