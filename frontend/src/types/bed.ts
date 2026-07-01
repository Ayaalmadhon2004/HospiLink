export type BedStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'| 'CLEANING';

export interface Bed {
  id: string;
  bedNumber: string;
  status: BedStatus;
  wardId: string;
  patientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BedWithDetails extends Bed {
  ward: { name: string };
  patient?: { name: string; id: string } | null;
}

export interface PatientOption {
  id: string;
  name: string;
}