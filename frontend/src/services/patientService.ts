// services/patientService.ts
import { apiGet, apiPost, apiPut, apiUpload } from './api';
import { toQueryString, type ApiResponse, type Pagination, type QueryParams } from '../types/api';
import type { PatientFlowDay } from '../utils/patientFlow';
import type { Patient, PatientDetail, PatientReport, RecentPatient } from '../types/patient';

export const getPatients = async (params?: QueryParams) => {
  return await apiGet<ApiResponse<Patient[]> & { pagination?: Pagination }>(`/patients${toQueryString(params)}`);
};

export const getRecentPatients = async () => {
  return await apiGet<ApiResponse<RecentPatient[]>>('/patients/recent');
};

export const getPatientFlow = async (days = 7) => {
  return await apiGet<ApiResponse<PatientFlowDay[]>>(`/patients/flow${toQueryString({ days })}`);
};

export const getPatientById = async (id: string) => {
  return await apiGet<ApiResponse<PatientDetail>>(`/patients/${id}`);
};

export const admitPatient = async (data: Partial<Patient>) => {
  return await apiPost('/patients/admit', data);
};

export const updatePatient = async (id: string, data: Partial<Patient>) => {
  return await apiPut(`/patients/${id}`, data);
};

export const dischargePatient = async (id: string) => {
  return await apiPut(`/patients/${id}/discharge`);
};

export const uploadReport = async (file: File, patientId: string) => {
  const formData = new FormData();
  formData.append('reportFile', file);
  // Rejects with an ApiError on failure, so the UI never reports a false success.
  return await apiUpload(`/patients/${patientId}/reports`, formData);
};

export const getPatientReports = async (patientId: string) => {
  return await apiGet<ApiResponse<PatientReport[]>>(`/patients/${patientId}/reports`);
};

export const getAvailableBeds = async (department?: string) => {
  const params = department ? `?department=${encodeURIComponent(department)}` : '';
  return await apiGet(`/patients/beds/available${params}`);
};