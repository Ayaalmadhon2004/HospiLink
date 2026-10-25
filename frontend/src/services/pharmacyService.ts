// services/pharmacyService.ts
import { apiGet, apiPost } from './api';
import type { ApiResponse } from '../types/api';
import type { Medication, PrescriptionItem } from '../types/clinical';

export const pharmacyKeys = { stock: ['pharmacy', 'stock'], queue: ['pharmacy', 'queue'] };

export const getStock = async (lowOnly: boolean): Promise<Medication[]> =>
  (await apiGet<ApiResponse<Medication[]>>('/pharmacy/stock', { lowOnly: lowOnly || undefined, limit: 200 })).data;
export const receiveStock = (medicationId: string, quantity: number, note?: string) => apiPost('/pharmacy/receive', { medicationId, quantity, note });
export const adjustStock = (medicationId: string, delta: number, note: string) => apiPost('/pharmacy/adjust', { medicationId, delta, note });
export const dispenseItem = (prescriptionItemId: string, quantity: number) => apiPost('/pharmacy/dispense', { prescriptionItemId, quantity });

export interface QueueItem extends Omit<PrescriptionItem, 'medication'> {
  medication: PrescriptionItem['medication'] & { active: boolean };
  _count: { dispensations: number };
}
export interface QueuePrescription {
  id: string;
  createdAt: string;
  prescriberName: string;
  patient: { id: string; name: string; patientCode: string };
  items: QueueItem[];
}
export const getQueue = async (q: string): Promise<QueuePrescription[]> =>
  (await apiGet<ApiResponse<QueuePrescription[]>>('/pharmacy/queue', { q: q.trim() || undefined, limit: 100 })).data;
