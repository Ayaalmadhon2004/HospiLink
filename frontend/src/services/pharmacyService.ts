// services/pharmacyService.ts
import { apiGet, apiPost } from './api';
import { apiGetAll } from './paginate';
import type { ApiResponse, Pagination } from '../types/api';
import type { Dispensation, Medication, StockMovement, StockMovementType } from '../types/clinical';

export const pharmacyKeys = {
  stock: ['pharmacy', 'stock'],
  movements: ['pharmacy', 'movements'],
  dispensations: (patientId: string) => ['pharmacy', 'dispensations', patientId],
};

export interface MovementFilters { medicationId?: string; type?: StockMovementType; page: number }
export interface MovementsPage { rows: StockMovement[]; pagination?: Pagination }
export const MOVEMENTS_PAGE_SIZE = 50;

export const getMovements = async ({ medicationId, type, page }: MovementFilters): Promise<MovementsPage> => {
  const res = await apiGet<ApiResponse<StockMovement[]> & { pagination?: Pagination }>('/pharmacy/movements', {
    medicationId: medicationId || undefined, type: type || undefined, page, limit: MOVEMENTS_PAGE_SIZE,
  });
  return { rows: res.data, pagination: res.pagination };
};
export const getDispensations = async (patientId: string): Promise<Dispensation[]> =>
  (await apiGet<ApiResponse<Dispensation[]>>('/pharmacy/dispensations', { patientId, limit: 50 })).data;

// Every page, so a catalogue of more than 200 medications is never silently cut off.
export const getStock = async (lowOnly: boolean): Promise<Medication[]> =>
  (await apiGetAll<Medication>('/pharmacy/stock', { lowOnly: lowOnly || undefined })).data;
export const receiveStock = (medicationId: string, quantity: number, note?: string) => apiPost('/pharmacy/receive', { medicationId, quantity, note });
export const adjustStock = (medicationId: string, delta: number, note: string) => apiPost('/pharmacy/adjust', { medicationId, delta, note });
export const dispenseItem = (prescriptionItemId: string, quantity: number) => apiPost('/pharmacy/dispense', { prescriptionItemId, quantity });
