import type { Role } from '../configs/permissions';

export type AccountStatus = 'PENDING' | 'ACTIVE' | 'DISABLED';

/** A login of the admin's hospital as returned by GET /users (never carries the password hash). */
export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string;
  accountStatus: AccountStatus;
  createdAt: string;
}

export const ROLES: readonly Role[] = ['ADMIN', 'DOCTOR', 'NURSE', 'DISPATCHER', 'PHARMACIST', 'BILLING'];
