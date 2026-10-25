// services/userService.ts
import { apiGet, apiPut } from './api';
import type { ApiResponse } from '../types/api';
import type { Role } from '../configs/permissions';
import type { ManagedUser } from '../types/user';

export const USERS_KEY = ['users'];

export const getUsers = async (): Promise<ManagedUser[]> => (await apiGet<ApiResponse<ManagedUser[]>>('/users')).data;
export const approveUser = (id: string, role: Role) => apiPut(`/users/${id}/approve`, { role });
export const rejectUser = (id: string) => apiPut(`/users/${id}/reject`);
export const deactivateUser = (id: string) => apiPut(`/users/${id}/deactivate`);
export const activateUser = (id: string, role: Role) => apiPut(`/users/${id}/activate`, { role });
export const changeUserRole = (id: string, role: Role) => apiPut(`/users/${id}/role`, { role });
