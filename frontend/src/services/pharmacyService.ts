// services/pharmacyService.ts
import { apiGet, apiPost } from './api';
import type { ApiResponse } from '../types/api';
import type { Medication } from '../types/clinical';

export const pharmacyKeys = { stock: ['pharmacy', 'stock'] };

export const getStock = async (lowOnly: boolean): Promise<Medication[]> =>
  (await apiGet<ApiResponse<Medication[]>>('/pharmacy/stock', { lowOnly: lowOnly || undefined, limit: 200 })).data;
export const receiveStock = (medicationId: string, quantity: number, note?: string) => apiPost('/pharmacy/receive', { medicationId, quantity, note });
export const adjustStock = (medicationId: string, delta: number, note: string) => apiPost('/pharmacy/adjust', { medicationId, delta, note });
export const dispenseItem = (prescriptionItemId: string, quantity: number) => apiPost('/pharmacy/dispense', { prescriptionItemId, quantity });
