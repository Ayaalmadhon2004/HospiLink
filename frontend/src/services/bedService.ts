// services/bedService.ts
import { apiGet } from './api';

export const getBeds = async () => {
  const res = await apiGet('/beds');
  return res;
};

export const getAvailableBeds = async () => {
  const res = await apiGet('/beds/available');
  return res;  // ← apiGet بيرجع data مباشرة
};