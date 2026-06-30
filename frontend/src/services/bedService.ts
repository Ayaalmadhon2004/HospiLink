// frontend/src/services/bedService.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const getAvailableBeds = async () => {
  const response = await api.get('/beds/available');
  return response.data;
};