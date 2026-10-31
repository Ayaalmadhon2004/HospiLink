import type { Shift } from '../../types/staff';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  hasLogin?: boolean;
  shifts?: Shift[];
}
