// configs/entityConfigs.ts
import { z } from 'zod';
import { DEPARTMENT_OPTIONS, GENDER_OPTIONS } from '../constants/hospital';
import type { FieldConfig } from '../components/Form/types';

// ─── Shared Validation Helpers ─────────────────────────────────────
const requiredString = (label: string) =>
  z.string().min(1, `${label} is required`);

// ─── 1. PATIENT CONFIG ─────────────────────────────────────────────
export interface PatientFormValues {
  name: string;
  age: string;
  gender: string;
  department: string;
  diagnosis: string;
  bedId?: string;
}

export const patientFields: FieldConfig<PatientFormValues>[] = [
  { name: 'name', label: 'forms.patient.name', type: 'text', required: true, colSpan: 2, placeholder: 'forms.patient.namePlaceholder' },
  { name: 'age', label: 'forms.patient.age', type: 'number', required: true, colSpan: 1, placeholder: 'forms.patient.agePlaceholder' },
  { name: 'gender', label: 'forms.patient.gender', type: 'select', required: true, colSpan: 1, options: GENDER_OPTIONS },
  { name: 'department', label: 'forms.patient.department', type: 'select', required: true, colSpan: 2, options: DEPARTMENT_OPTIONS },
  { name: 'diagnosis', label: 'forms.patient.diagnosis', type: 'text', required: true, colSpan: 2, placeholder: 'forms.patient.diagnosisPlaceholder' },
  {
    name: 'bedId',
    label: 'forms.patient.bedId',
    type: 'search-select',
    colSpan: 2,
    dependsOn: 'department',
    apiEndpoint: '/patients/beds/available?department={department}',
    placeholder: 'forms.patient.bedIdPlaceholder',
  },
];

export const patientValidationSchema = z.object({
  name: requiredString('Name'),
  age: z.string().min(1, 'Age is required').refine((v) => {
    const n = Number(v);
    return !isNaN(n) && n >= 0 && n <= 150;
  }, 'Age must be between 0 and 150'),
  gender: requiredString('Gender'),
  department: requiredString('Department'),
  diagnosis: requiredString('Diagnosis'),
  bedId: z.string().optional(),
});

// ─── 2. BED CONFIG ───────────────────────────────────────────────
export interface BedFormValues {
  bedNumber: string;
  wardId: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';
  patientId?: string;
}

const BED_STATUS_OPTIONS = [
  { label: 'beds.status.AVAILABLE', value: 'AVAILABLE' },
  { label: 'beds.status.OCCUPIED', value: 'OCCUPIED' },
  { label: 'beds.status.CLEANING', value: 'CLEANING' },
  { label: 'beds.status.MAINTENANCE', value: 'MAINTENANCE' },
];

export const bedFields: FieldConfig<BedFormValues>[] = [
  { name: 'bedNumber', label: 'forms.bed.bedNumber', type: 'text', required: true, placeholder: 'forms.bed.bedNumberPlaceholder' },
  {
    name: 'wardId',
    label: 'forms.bed.wardId',
    type: 'search-select',
    required: true,
    apiEndpoint: '/wards',
    placeholder: 'forms.bed.wardIdPlaceholder',
  },
  {
    name: 'status',
    label: 'forms.bed.status',
    type: 'select',
    required: true,
    options: BED_STATUS_OPTIONS,
    disabled: (vals) => !!vals.patientId,
  },
  {
    name: 'patientId',
    label: 'forms.bed.patientId',
    type: 'search-select',
    apiEndpoint: '/patients/unassigned',
    placeholder: 'forms.bed.patientIdPlaceholder',
    helperText: 'forms.bed.patientIdHelper',
  },
];

export const bedValidationSchema = z.object({
  bedNumber: requiredString('Bed number'),
  wardId: requiredString('Ward'),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE']),
  patientId: z.string().optional(),
});

// ─── 3. APPOINTMENT CONFIG ──────────────────────────────────────
export interface AppointmentFormValues {
  patientName: string;
  patientCode: string;
  doctorId: string;
  type: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: string;
  department: string;
  room: string;
  notes: string;
}

const APPOINTMENT_TYPE_OPTIONS = [
  { label: 'appointments.types.CONSULTATION', value: 'CONSULTATION' },
  { label: 'appointments.types.SURGERY', value: 'SURGERY' },
  { label: 'appointments.types.IMAGING', value: 'IMAGING' },
  { label: 'appointments.types.FOLLOW_UP', value: 'FOLLOW_UP' },
];

export const appointmentFields: FieldConfig<AppointmentFormValues>[] = [
  { name: 'patientName', label: 'forms.appointment.patientName', type: 'text', required: true, colSpan: 1, placeholder: 'forms.appointment.patientNamePlaceholder' },
  { name: 'patientCode', label: 'forms.appointment.patientCode', type: 'text', required: true, colSpan: 1, placeholder: 'forms.appointment.patientCodePlaceholder' },
  {
    name: 'doctorId',
    label: 'forms.appointment.doctorId',
    type: 'search-select',
    required: true,
    apiEndpoint: '/staff?role=doctor',
    placeholder: 'forms.appointment.doctorIdPlaceholder',
  },
  { name: 'type', label: 'forms.appointment.type', type: 'select', required: true, options: APPOINTMENT_TYPE_OPTIONS },
  { name: 'scheduledDate', label: 'forms.appointment.scheduledDate', type: 'date', required: true, colSpan: 1 },
  { name: 'scheduledTime', label: 'forms.appointment.scheduledTime', type: 'time', required: true, colSpan: 1 },
  { name: 'duration', label: 'forms.appointment.duration', type: 'number', colSpan: 1, placeholder: 'forms.appointment.durationPlaceholder' },
  { name: 'department', label: 'forms.appointment.department', type: 'text', colSpan: 1, placeholder: 'forms.appointment.departmentPlaceholder' },
  { name: 'room', label: 'forms.appointment.room', type: 'text', placeholder: 'forms.appointment.roomPlaceholder' },
  { name: 'notes', label: 'forms.appointment.notes', type: 'textarea', rows: 3, placeholder: 'forms.appointment.notesPlaceholder' },
];

export const appointmentValidationSchema = z.object({
  patientName: requiredString('Patient name'),
  patientCode: requiredString('Patient code'),
  doctorId: requiredString('Doctor'),
  type: requiredString('Type'),
  scheduledDate: requiredString('Date'),
  scheduledTime: requiredString('Time'),
  duration: z.string().optional(),
  department: z.string().optional(),
  room: z.string().optional(),
  notes: z.string().optional(),
});

// ─── 4. STAFF CONFIG ─────────────────────────────────────────────
export interface StaffFormValues {
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  shiftStart: string;
  shiftEnd: string;
  /** Create mode only: also creates a login with this system role and emails a set-password link. */
  loginRole?: string;
}

const STAFF_ROLE_OPTIONS = [
  { label: 'staff.roles.Cardiologist', value: 'Cardiologist' },
  { label: 'staff.roles.Intensivist', value: 'Intensivist' },
  { label: 'staff.roles.Surgeon', value: 'Surgeon' },
  { label: 'staff.roles.Pediatrician', value: 'Pediatrician' },
  { label: 'staff.roles.Obstetrician', value: 'Obstetrician' },
  { label: 'staff.roles.Neurologist', value: 'Neurologist' },
  { label: 'staff.roles.Nurse', value: 'Nurse' },
  { label: 'staff.roles.Admin', value: 'Admin' },
  { label: 'staff.roles.Technician', value: 'Technician' },
];

const STAFF_LOGIN_ROLE_OPTIONS = [
  { label: 'staff.loginRoles.DOCTOR', value: 'DOCTOR' },
  { label: 'staff.loginRoles.NURSE', value: 'NURSE' },
  { label: 'staff.loginRoles.DISPATCHER', value: 'DISPATCHER' },
  { label: 'staff.loginRoles.ADMIN', value: 'ADMIN' },
];

const STAFF_STATUS_OPTIONS = [
  { label: 'staff.status.ACTIVE', value: 'ACTIVE' },
  { label: 'staff.status.ON_LEAVE', value: 'ON_LEAVE' },
  { label: 'staff.status.INACTIVE', value: 'INACTIVE' },
];

export const staffFields: FieldConfig<StaffFormValues>[] = [
  { name: 'name', label: 'forms.staff.name', type: 'text', required: true, colSpan: 2, placeholder: 'forms.staff.namePlaceholder' },
  { name: 'email', label: 'forms.staff.email', type: 'email', required: true, colSpan: 1, placeholder: 'forms.staff.emailPlaceholder' },
  { name: 'phone', label: 'forms.staff.phone', type: 'tel', colSpan: 1, placeholder: 'forms.staff.phonePlaceholder' },
  { name: 'role', label: 'forms.staff.role', type: 'select', required: true, options: STAFF_ROLE_OPTIONS },
  { name: 'department', label: 'forms.staff.department', type: 'select', required: true, options: DEPARTMENT_OPTIONS },
  { name: 'status', label: 'forms.staff.status', type: 'select', required: true, options: STAFF_STATUS_OPTIONS },
  { name: 'shiftStart', label: 'forms.staff.shiftStart', type: 'time', colSpan: 1 },
  { name: 'shiftEnd', label: 'forms.staff.shiftEnd', type: 'time', colSpan: 1 },
  {
    name: 'loginRole',
    label: 'forms.staff.loginRole',
    type: 'select',
    options: STAFF_LOGIN_ROLE_OPTIONS,
    colSpan: 2,
    placeholder: 'forms.staff.loginRoleNone',
    helperText: 'forms.staff.loginRoleHelp',
  },
];

export const staffValidationSchema = z.object({
  name: requiredString('Name'),
  email: z.string().email('Invalid email').min(1, 'Email is required'),
  phone: z.string().optional(),
  role: requiredString('Role'),
  department: requiredString('Department'),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'INACTIVE']),
  shiftStart: z.string().optional(),
  shiftEnd: z.string().optional(),
  loginRole: z.enum(['ADMIN', 'DOCTOR', 'NURSE', 'DISPATCHER']).optional().or(z.literal('')),
});

// ─── 5. INCIDENT CONFIG (FIXED) ────────────────────────────────────
export interface IncidentFormValues {
  title: string;        // ← ✅ Added
  type: string;
  severity: 'CRITICAL' | 'ELEVATED' | 'MODERATE' | 'LOW';
  location: string;
  reportedBy: string;
  description: string;
}

const INCIDENT_TYPE_OPTIONS = [
  { label: 'incidents.types.MEDICAL_ERROR', value: 'MEDICAL_ERROR' },
  { label: 'incidents.types.EQUIPMENT_FAILURE', value: 'EQUIPMENT_FAILURE' },
  { label: 'incidents.types.PATIENT_FALL', value: 'PATIENT_FALL' },
  { label: 'incidents.types.SECURITY', value: 'SECURITY' },
  { label: 'incidents.types.OTHER', value: 'OTHER' },
];

const SEVERITY_OPTIONS = [
  { label: 'incidents.severity.CRITICAL', value: 'CRITICAL' },
  { label: 'incidents.severity.ELEVATED', value: 'ELEVATED' },
  { label: 'incidents.severity.MODERATE', value: 'MODERATE' },
  { label: 'incidents.severity.LOW', value: 'LOW' },
];

export const incidentFields: FieldConfig<IncidentFormValues>[] = [
  { name: 'title', label: 'forms.incident.title', type: 'text', required: true, colSpan: 2, placeholder: 'forms.incident.titlePlaceholder' },
  { name: 'type', label: 'forms.incident.type', type: 'select', required: true, options: INCIDENT_TYPE_OPTIONS, colSpan: 1 },
  { name: 'severity', label: 'forms.incident.severity', type: 'select', required: true, options: SEVERITY_OPTIONS, colSpan: 1 },
  { name: 'location', label: 'forms.incident.location', type: 'text', required: true, placeholder: 'forms.incident.locationPlaceholder', colSpan: 1 },
  { name: 'reportedBy', label: 'forms.incident.reportedBy', type: 'text', required: true, placeholder: 'forms.incident.reportedByPlaceholder', colSpan: 1 },
  { name: 'description', label: 'forms.incident.description', type: 'textarea', required: true, rows: 4, placeholder: 'forms.incident.descriptionPlaceholder', colSpan: 2 },
];

// ✅ FIXED: added title to validation
export const incidentValidationSchema = z.object({
  title: requiredString('Incident title'),
  type: requiredString('Incident type'),
  severity: z.enum(['CRITICAL', 'ELEVATED', 'MODERATE', 'LOW']),
  location: requiredString('Location'),
  reportedBy: requiredString('Reported by'),
  description: requiredString('Description'),
});

// ─── WARD CONFIG ───────────────────────────────────────────────────
export interface WardFormValues {
  name: string;
  floor?: string;
}

export const wardFields: FieldConfig<WardFormValues>[] = [
  { name: 'name', label: 'forms.ward.name', type: 'text', required: true, colSpan: 2, placeholder: 'forms.ward.namePlaceholder' },
  { name: 'floor', label: 'forms.ward.floor', type: 'number', colSpan: 1, placeholder: 'forms.ward.floorPlaceholder' },
];

export const wardValidationSchema = z.object({
  name: requiredString('Ward name').max(100),
  floor: z.string().optional().refine((v) => !v || Number.isInteger(Number(v)), 'Floor must be a whole number'),
});


// ─── CLINICAL RECORDS ──────────────────────────────────────────────
export interface NoteFormValues {
  type: string;
  content: string;
}
export const noteTypeOptions = (types: readonly string[]) => types.map((v) => ({ label: `clinical.noteTypes.${v}`, value: v }));
export const noteFields = (types: readonly string[]): FieldConfig<NoteFormValues>[] => [
  { name: 'type', label: 'forms.note.type', type: 'select', required: true, colSpan: 2, options: noteTypeOptions(types) },
  { name: 'content', label: 'forms.note.content', type: 'textarea', required: true, rows: 6, colSpan: 2, placeholder: 'forms.note.contentPlaceholder' },
];
export const amendFields: FieldConfig<{ content: string }>[] = [
  { name: 'content', label: 'forms.note.correctedContent', type: 'textarea', required: true, rows: 6, colSpan: 2, helperText: 'forms.note.amendHint' },
];

export interface LabOrderFormValues {
  testName: string;
  testCode?: string;
  priority: string;
  notes?: string;
}
export const labOrderFields: FieldConfig<LabOrderFormValues>[] = [
  { name: 'testName', label: 'forms.labOrder.testName', type: 'text', required: true, colSpan: 2, placeholder: 'forms.labOrder.testNamePlaceholder' },
  { name: 'testCode', label: 'forms.labOrder.testCode', type: 'text', colSpan: 1 },
  {
    name: 'priority', label: 'forms.labOrder.priority', type: 'select', required: true, colSpan: 1,
    options: ['ROUTINE', 'URGENT', 'STAT'].map((v) => ({ label: `clinical.priority.${v}`, value: v })),
  },
  { name: 'notes', label: 'forms.labOrder.notes', type: 'textarea', rows: 3, colSpan: 2 },
];

export interface MedicationFormValues {
  name: string;
  genericName?: string;
  form: string;
  strength: string;
}
export const medicationFields: FieldConfig<MedicationFormValues>[] = [
  { name: 'name', label: 'forms.medication.name', type: 'text', required: true, colSpan: 1 },
  { name: 'genericName', label: 'forms.medication.genericName', type: 'text', colSpan: 1 },
  { name: 'form', label: 'forms.medication.form', type: 'text', required: true, colSpan: 1, placeholder: 'forms.medication.formPlaceholder' },
  { name: 'strength', label: 'forms.medication.strength', type: 'text', required: true, colSpan: 1, placeholder: 'forms.medication.strengthPlaceholder' },
];
