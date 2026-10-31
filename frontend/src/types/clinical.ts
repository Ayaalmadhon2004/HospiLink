export type NoteType = 'PROGRESS' | 'ADMISSION' | 'CONSULTATION' | 'DISCHARGE' | 'NURSING';
export const NOTE_TYPES: readonly NoteType[] = ['PROGRESS', 'ADMISSION', 'CONSULTATION', 'DISCHARGE', 'NURSING'];

export interface ClinicalNote {
  id: string;
  patientId: string;
  type: NoteType;
  content: string;
  authorName: string;
  /** Set when this note is a correction of an earlier one. */
  supersedesId: string | null;
  createdAt: string;
}

export interface Medication {
  id: string;
  name: string;
  genericName: string | null;
  form: string;
  strength: string;
  active: boolean;
  /** Pharmacy (absent in payloads that predate it). */
  stockQuantity?: number;
  reorderLevel?: number;
  unitPriceMinor?: number;
}

export type PrescriptionStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface PrescriptionItem {
  id: string;
  dose: string;
  frequency: string;
  route: string | null;
  durationDays: number | null;
  instructions: string | null;
  medication: Pick<Medication, 'id' | 'name' | 'form' | 'strength'>;
}

export interface Prescription {
  id: string;
  status: PrescriptionStatus;
  notes: string | null;
  prescriberName: string;
  createdAt: string;
  items: PrescriptionItem[];
}

export type LabPriority = 'ROUTINE' | 'URGENT' | 'STAT';
export type LabOrderStatus = 'ORDERED' | 'RESULTED' | 'CANCELLED';
export type LabFlag = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_LOW' | 'CRITICAL_HIGH';

export interface LabResult {
  id: string;
  analyte: string;
  value: number | null;
  textValue: string | null;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  flag: LabFlag | null;
}

export interface LabOrder {
  id: string;
  testName: string;
  testCode: string | null;
  priority: LabPriority;
  status: LabOrderStatus;
  notes: string | null;
  orderedByName: string;
  orderedAt: string;
  resultedAt: string | null;
  results: LabResult[];
}

/** One row of the lab-result entry form; numbers stay strings until submit. */
export interface LabResultDraft {
  analyte: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
  criticalLow: string;
  criticalHigh: string;
}

export type StockMovementType = 'RECEIVE' | 'DISPENSE' | 'ADJUST';
export const STOCK_MOVEMENT_TYPES: readonly StockMovementType[] = ['RECEIVE', 'DISPENSE', 'ADJUST'];

/** One row of the append-only stock ledger (`GET /pharmacy/movements`, ADMIN). */
export interface StockMovement {
  id: string;
  medicationId: string;
  type: StockMovementType;
  delta: number;
  note: string | null;
  userName: string;
  createdAt: string;
  medication: { name: string; strength: string };
}

/** Units handed to a patient (`GET /pharmacy/dispensations?patientId=`). */
export interface Dispensation {
  id: string;
  quantity: number;
  unitPriceMinor: number;
  dispensedByName: string;
  createdAt: string;
  medication: { name: string; form: string; strength: string };
}
