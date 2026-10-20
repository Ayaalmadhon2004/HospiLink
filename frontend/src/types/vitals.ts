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
