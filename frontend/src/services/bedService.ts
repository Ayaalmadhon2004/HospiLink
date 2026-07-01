// services/bedService.ts
import { apiGet } from './api';

export const getAvailableBeds = async () => {
  const res = await apiGet('/beds/available');
  return res.json();
};