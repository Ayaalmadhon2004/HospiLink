// frontend/src/services/incidentsService.ts
import { apiGet, apiPost, apiPut, apiDelete } from './api';

export const getIncidents = (params?: { status?: string; severity?: string; type?: string }) => {
  const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
  return apiGet(`/incidents${query}`);
};

export const getActiveIncidents = () => apiGet('/incidents?status=ACTIVE');

export const getIncidentById = (id: string) => apiGet(`/incidents/${id}`);

export const createIncident = (data: any) => apiPost('/incidents', data);

export const updateIncident = (id: string, data: any) => apiPut(`/incidents/${id}`, data);

export const updateIncidentStatus = (id: string, status: string, progress?: number) => 
  apiPut(`/incidents/${id}/status`, { status, progress });

export const deleteIncident = (id: string) => apiDelete(`/incidents/${id}`);