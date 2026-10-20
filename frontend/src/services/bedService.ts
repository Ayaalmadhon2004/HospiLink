// services/bedService.ts
import { apiGet } from './api';
import type { ApiResponse } from '../types/api';
import type { BedWithDetails } from '../types/bed';

export const getBeds = async () => {
  const res = await apiGet<ApiResponse<BedWithDetails[]>>('/beds');
  return res;
};

export const getAvailableBeds = async () => {
  const res = await apiGet<ApiResponse<BedWithDetails[]>>('/beds/available');
  return res;  // ← apiGet بيرجع data مباشرة
};