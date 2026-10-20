export type PatientStatus = 'CRITICAL' | 'STABLE' | 'OBSERVATION' | 'DISCHARGED' | string;

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  status: PatientStatus;
  admissionDate: string;
  dischargeDate?: string;
  department: string;
  diagnosis?: string;
  patientCode: string;
  bedId?: string | null;
  doctorId?: string | null;
  hospitalId?: string;
  bed?: { id?: string; bedNumber: string; ward: { name: string } } | null;
  doctor?: { id: string; name: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Shape returned by GET /patients/:id (bed carries a flat wardName). */
export type PatientDetail = Omit<Patient, 'bed'> & {
  bed?: { id?: string; bedNumber: string; wardName: string } | null;
};

/** Row shape returned by GET /patients/recent. */
export interface RecentPatient {
  id: string;
  name: string;
  status: 'OBSERVATION' | 'CRITICAL' | 'STABLE' | 'DISCHARGED';
  physicianName: string;
  bed: { wardName: string; bedNumber: string } | null;
}

export interface PatientReport {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  patientId?: string;
  uploadedBy?: string | null;
  createdAt: string;
}
