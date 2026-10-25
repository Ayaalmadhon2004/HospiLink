// services/wardService.ts
import { apiGet, apiPost, apiPut, apiDelete } from './api';
import type { ApiResponse } from '../types/api';
import type { Ward } from '../types/ward';

export const WARDS_KEY = ['wards'];

export interface WardInput {
  name: string;
  /** null clears the floor on update. */
  floor?: number | null;
}

export const getWards = async (): Promise<Ward[]> => (await apiGet<ApiResponse<Ward[]>>('/wards')).data;
export const createWard = (body: WardInput) => apiPost<ApiResponse<Ward>>('/wards', body);
export const updateWard = (id: string, body: WardInput) => apiPut<ApiResponse<Ward>>(`/wards/${id}`, body);
export const deleteWard = (id: string) => apiDelete(`/wards/${id}`);
