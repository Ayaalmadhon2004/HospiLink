// frontend/src/services/incidentsService.ts
import { apiGet, apiPost, apiPut, apiDelete } from './api';
import type { ApiResponse } from '../types/api';
import type { CreateIncidentData, Incident } from '../types/incident';

export const getIncidents = (params?: {
  status?: string;
  severity?: string;
  type?: string;
}) => {
  const query = params
    ? '?' + new URLSearchParams(params as Record<string, string>).toString()
    : '';
  return apiGet<ApiResponse<Incident[]>>(`/incidents${query}`);
};

export const getActiveIncidents = () => apiGet('/incidents?status=ACTIVE');

export const getIncidentById = (id: string) => apiGet(`/incidents/${id}`);

export const createIncident = (data: CreateIncidentData) => apiPost('/incidents', data);

export const updateIncident = (id: string, data: CreateIncidentData) =>
  apiPut(`/incidents/${id}`, data);

export const updateIncidentStatus = (
  id: string,
  status: string,
  progress?: number
) => apiPut(`/incidents/${id}/status`, { status, progress });

export const deleteIncident = (id: string) => apiDelete(`/incidents/${id}`);