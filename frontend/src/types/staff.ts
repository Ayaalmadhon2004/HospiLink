export interface Shift {
  id: string;
  staffId: string;
  type: string;
  startTime: string;
  endTime: string;
  department: string;
  notes?: string | null;
  staffName?: string;
  staff?: { id: string; name: string; role?: string };
}

export type ShiftInput = Partial<Omit<Shift, 'id' | 'staff'>>;

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string | null;
  phone?: string | null;
  isActive?: boolean;
  /** False when no login is linked: the member cannot sign in and gets no appointment/shift notifications. */
  hasLogin?: boolean;
  status?: string;
  shifts?: Shift[];
  createdAt?: string;
  updatedAt?: string;
}
