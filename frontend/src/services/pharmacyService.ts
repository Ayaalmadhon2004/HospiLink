// services/pharmacyService.ts
import { apiPost } from './api';
import { apiGetAll } from './paginate';
import type { Medication } from '../types/clinical';

export const pharmacyKeys = { stock: ['pharmacy', 'stock'] };

// Every page, so a catalogue of more than 200 medications is never silently cut off.
export const getStock = async (lowOnly: boolean): Promise<Medication[]> =>
  (await apiGetAll<Medication>('/pharmacy/stock', { lowOnly: lowOnly || undefined })).data;
export const receiveStock = (medicationId: string, quantity: number, note?: string) => apiPost('/pharmacy/receive', { medicationId, quantity, note });
export const adjustStock = (medicationId: string, delta: number, note: string) => apiPost('/pharmacy/adjust', { medicationId, delta, note });
export const dispenseItem = (prescriptionItemId: string, quantity: number) => apiPost('/pharmacy/dispense', { prescriptionItemId, quantity });
