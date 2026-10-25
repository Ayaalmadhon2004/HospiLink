// services/clinicalService.ts
import { apiGet, apiPost, apiPut } from './api';
import type { ApiResponse } from '../types/api';
import type { ClinicalNote, LabOrder, LabResultDraft, Medication, NoteType, Prescription } from '../types/clinical';

const list = async <T>(url: string, params: Record<string, string | number | boolean | undefined>): Promise<T[]> =>
  (await apiGet<ApiResponse<T[]>>(url, { ...params, limit: 200 })).data;

export const clinicalKeys = {
  notes: (patientId: string) => ['clinical', 'notes', patientId],
  prescriptions: (patientId: string) => ['clinical', 'prescriptions', patientId],
  labs: (patientId: string) => ['clinical', 'labs', patientId],
  medications: ['clinical', 'medications'],
};

// notes
export const getNotes = (patientId: string) => list<ClinicalNote>('/clinical-notes', { patientId });
export const getNoteHistory = async (id: string): Promise<ClinicalNote[]> => (await apiGet<ApiResponse<ClinicalNote[]>>(`/clinical-notes/${id}/history`)).data;
export const createNote = (body: { patientId: string; type: NoteType; content: string }) => apiPost('/clinical-notes', body);
export const amendNote = (id: string, content: string) => apiPost(`/clinical-notes/${id}/amend`, { content });

// medications
export const getMedications = (activeOnly = false) => list<Medication>('/medications', activeOnly ? { active: true } : {});
export const createMedication = (body: { name: string; genericName?: string; form: string; strength: string }) => apiPost('/medications', body);
export const setMedicationActive = (id: string, active: boolean) => apiPut(`/medications/${id}`, { active });

// prescriptions
export interface PrescriptionItemInput {
  medicationId: string;
  dose: string;
  frequency: string;
  route?: string;
  durationDays?: number;
  instructions?: string;
}
export const getPrescriptions = (patientId: string) => list<Prescription>('/prescriptions', { patientId });
export const createPrescription = (body: { patientId: string; notes?: string; items: PrescriptionItemInput[] }) => apiPost('/prescriptions', body);
export const closePrescription = (id: string, status: 'COMPLETED' | 'CANCELLED') => apiPut(`/prescriptions/${id}/status`, { status });

// lab orders
const num = (v: string): number | undefined => (v.trim() === '' ? undefined : Number(v));
export const getLabOrders = (patientId: string) => list<LabOrder>('/lab-orders', { patientId });
export const createLabOrder = (body: { patientId: string; testName: string; testCode?: string; priority?: string; notes?: string }) => apiPost('/lab-orders', body);
export const cancelLabOrder = (id: string) => apiPut(`/lab-orders/${id}/cancel`);
export const submitLabResults = (id: string, rows: LabResultDraft[]) =>
  apiPost(`/lab-orders/${id}/results`, {
    results: rows.map((r) => ({
      analyte: r.analyte.trim(),
      ...(r.value.trim() === '' ? {} : Number.isNaN(Number(r.value)) ? { textValue: r.value.trim() } : { value: Number(r.value) }),
      unit: r.unit.trim() || undefined,
      refLow: num(r.refLow), refHigh: num(r.refHigh), criticalLow: num(r.criticalLow), criticalHigh: num(r.criticalHigh),
    })),
  });
