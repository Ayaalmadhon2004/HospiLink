export interface Vitals {
  id: string;
  patientId: string;
  heartRate: number | null;
  systolicBP: number | null;
  diastolicBP: number | null;
  spO2: number | null;
  temperature: number | null;
  respiratoryRate: number | null;
  recordedAt: string;
  recordedBy?: string;
  notes?: string | null;
  isCritical: boolean;
  alertType?: string | null;
  patient?: { id: string; name: string; patientCode?: string };
}

/** The readings of one entry (what the cards and charts need). */
export type VitalRecord = Pick<
  Vitals,
  'id' | 'recordedAt' | 'heartRate' | 'systolicBP' | 'diastolicBP' | 'spO2' | 'temperature' | 'respiratoryRate' | 'isCritical'
>;

/** Row of GET /vitals/alerts. */
export interface VitalAlert {
  id: string;
  patient: { name: string; patientCode: string; department: string };
  alertType: string;
  recordedAt: string;
  heartRate?: number;
  systolicBP?: number;
  spO2?: number;
}

/** Body of POST /vitals: only the metrics that were measured are sent. */
export interface RecordVitalsInput {
  patientId: string;
  heartRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  spO2?: number;
  temperature?: number;
  respiratoryRate?: number;
  notes?: string;
}
