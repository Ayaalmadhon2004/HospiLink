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
  { name: 'name', label: 'Full Name', type: 'text', required: true, colSpan: 2, placeholder: 'Enter patient name' },
  { name: 'age', label: 'Age', type: 'number', required: true, colSpan: 1, placeholder: 'Years' },
  { name: 'gender', label: 'Gender', type: 'select', required: true, colSpan: 1, options: GENDER_OPTIONS },
  { name: 'department', label: 'Department', type: 'select', required: true, colSpan: 2, options: DEPARTMENT_OPTIONS },
  { name: 'diagnosis', label: 'Diagnosis', type: 'text', required: true, colSpan: 2, placeholder: 'Primary diagnosis' },
  {
    name: 'bedId',
    label: 'Assign Bed',
    type: 'search-select',
    colSpan: 2,
    dependsOn: 'department',
    apiEndpoint: '/patients/beds/available?department={department}',
    placeholder: 'Select an available bed',
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
  { label: 'Available', value: 'AVAILABLE' },
  { label: 'Occupied', value: 'OCCUPIED' },
  { label: 'Cleaning', value: 'CLEANING' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
];

export const bedFields: FieldConfig<BedFormValues>[] = [
  { name: 'bedNumber', label: 'Bed Number', type: 'text', required: true, placeholder: 'e.g. ICU-101' },
  {
    name: 'wardId',
    label: 'Ward / Department',
    type: 'search-select',
    required: true,
    apiEndpoint: '/wards',
    placeholder: 'Select ward...',
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: BED_STATUS_OPTIONS,
    disabled: (vals) => !!vals.patientId,
  },
  {
    name: 'patientId',
    label: 'Assign Patient',
    type: 'search-select',
    apiEndpoint: '/patients/unassigned',
    placeholder: '— Unassigned —',
    helperText: 'Auto-sets status to Occupied when assigned',
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
  { label: 'Consultation', value: 'CONSULTATION' },
  { label: 'Surgery', value: 'SURGERY' },
  { label: 'Imaging', value: 'IMAGING' },
  { label: 'Follow-up', value: 'FOLLOW_UP' },
];

export const appointmentFields: FieldConfig<AppointmentFormValues>[] = [
  { name: 'patientName', label: 'Patient Name', type: 'text', required: true, colSpan: 1, placeholder: 'John Doe' },
  { name: 'patientCode', label: 'Patient Code', type: 'text', required: true, colSpan: 1, placeholder: 'PT-2052' },
  {
    name: 'doctorId',
    label: 'Doctor',
    type: 'search-select',
    required: true,
    apiEndpoint: '/staff?role=doctor',
    placeholder: 'Select doctor...',
  },
  { name: 'type', label: 'Type', type: 'select', required: true, options: APPOINTMENT_TYPE_OPTIONS },
  { name: 'scheduledDate', label: 'Date', type: 'date', required: true, colSpan: 1 },
  { name: 'scheduledTime', label: 'Time', type: 'time', required: true, colSpan: 1 },
  { name: 'duration', label: 'Duration (min)', type: 'number', colSpan: 1, placeholder: '30' },
  { name: 'department', label: 'Department', type: 'text', colSpan: 1, placeholder: 'Cardiology' },
  { name: 'room', label: 'Room', type: 'text', placeholder: 'C-214' },
  { name: 'notes', label: 'Notes', type: 'textarea', rows: 3, placeholder: 'Additional notes...' },
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
}

const STAFF_ROLE_OPTIONS = [
  { label: 'Cardiologist', value: 'Cardiologist' },
  { label: 'Intensivist', value: 'Intensivist' },
  { label: 'Surgeon', value: 'Surgeon' },
  { label: 'Pediatrician', value: 'Pediatrician' },
  { label: 'Obstetrician', value: 'Obstetrician' },
  { label: 'Neurologist', value: 'Neurologist' },
  { label: 'Nurse', value: 'Nurse' },
  { label: 'Admin', value: 'Admin' },
  { label: 'Technician', value: 'Technician' },
];

const STAFF_STATUS_OPTIONS = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'On Leave', value: 'ON_LEAVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

export const staffFields: FieldConfig<StaffFormValues>[] = [
  { name: 'name', label: 'Full Name', type: 'text', required: true, colSpan: 2, placeholder: 'Dr. John Doe' },
  { name: 'email', label: 'Email', type: 'email', required: true, colSpan: 1, placeholder: 'john@hospilink.com' },
  { name: 'phone', label: 'Phone', type: 'tel', colSpan: 1, placeholder: '+1 234 567 890' },
  { name: 'role', label: 'Role', type: 'select', required: true, options: STAFF_ROLE_OPTIONS },
  { name: 'department', label: 'Department', type: 'select', required: true, options: DEPARTMENT_OPTIONS },
  { name: 'status', label: 'Status', type: 'select', required: true, options: STAFF_STATUS_OPTIONS },
  { name: 'shiftStart', label: 'Shift Start', type: 'time', colSpan: 1 },
  { name: 'shiftEnd', label: 'Shift End', type: 'time', colSpan: 1 },
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
  { label: 'Medical Error', value: 'MEDICAL_ERROR' },
  { label: 'Equipment Failure', value: 'EQUIPMENT_FAILURE' },
  { label: 'Patient Fall', value: 'PATIENT_FALL' },
  { label: 'Security', value: 'SECURITY' },
  { label: 'Other', value: 'OTHER' },
];

const SEVERITY_OPTIONS = [
  { label: 'Critical', value: 'CRITICAL' },
  { label: 'Elevated', value: 'ELEVATED' },
  { label: 'Moderate', value: 'MODERATE' },
  { label: 'Low', value: 'LOW' },
];

export const incidentFields: FieldConfig<IncidentFormValues>[] = [
  { name: 'title', label: 'Incident Title', type: 'text', required: true, colSpan: 2, placeholder: 'Short title for the incident' },
  { name: 'type', label: 'Incident Type', type: 'select', required: true, options: INCIDENT_TYPE_OPTIONS, colSpan: 1 },
  { name: 'severity', label: 'Severity', type: 'select', required: true, options: SEVERITY_OPTIONS, colSpan: 1 },
  { name: 'location', label: 'Location', type: 'text', required: true, placeholder: 'Ward / Room / Street', colSpan: 1 },
  { name: 'reportedBy', label: 'Reported By', type: 'text', required: true, placeholder: 'Staff name', colSpan: 1 },
  { name: 'description', label: 'Description', type: 'textarea', required: true, rows: 4, placeholder: 'Describe the incident in detail...', colSpan: 2 },
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