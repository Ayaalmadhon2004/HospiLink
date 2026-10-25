// backend/src/services/exports/datasets.ts
//
// One loader per export type. Every query is scoped to the caller's hospital (directly or through the patient) and
// excludes soft-deleted patients. Loaders fetch `limit + 1` rows so the caller can refuse an oversized export instead of
// silently truncating it.
import prisma from '../../config/db';
import type { DateRange, ExportColumn, ExportDataset, ExportRow, ExportType } from './types';

type Loader = (hospitalId: string, range: DateRange, take: number) => Promise<ExportDataset>;

const col = (key: string, header: string, kind: ExportColumn['kind'], width: number): ExportColumn => ({ key, header, kind, width });

const patients: Loader = async (hospitalId, range, take) => {
  const rows = await prisma.patient.findMany({
    where: { hospitalId, deletedAt: null, admissionDate: { gte: range.from, lt: range.to } },
    select: {
      patientCode: true, name: true, age: true, gender: true, status: true, department: true, diagnosis: true, admissionDate: true, dischargeDate: true,
      doctor: { select: { name: true } }, bed: { select: { bedNumber: true, ward: { select: { name: true } } } },
    },
    orderBy: [{ admissionDate: 'desc' }, { id: 'desc' }],
    take,
  });
  return {
    title: 'Patients',
    columns: [
      col('patientCode', 'Code', 'text', 10), col('name', 'Name', 'text', 22), col('age', 'Age', 'number', 6), col('gender', 'Gender', 'text', 9),
      col('status', 'Status', 'text', 12), col('department', 'Department', 'text', 14), col('diagnosis', 'Diagnosis', 'text', 24),
      col('doctor', 'Doctor', 'text', 18), col('bed', 'Bed', 'text', 14), col('admissionDate', 'Admitted', 'datetime', 16), col('dischargeDate', 'Discharged', 'datetime', 16),
    ],
    rows: rows.map((p): ExportRow => ({
      patientCode: p.patientCode, name: p.name, age: p.age, gender: p.gender, status: p.status, department: p.department, diagnosis: p.diagnosis,
      doctor: p.doctor?.name ?? null, bed: p.bed ? `${p.bed.ward.name} / ${p.bed.bedNumber}` : null, admissionDate: p.admissionDate, dischargeDate: p.dischargeDate,
    })),
  };
};

const appointments: Loader = async (hospitalId, range, take) => {
  const rows = await prisma.appointment.findMany({
    where: { patient: { hospitalId, deletedAt: null }, scheduledAt: { gte: range.from, lt: range.to } },
    select: {
      scheduledAt: true, duration: true, type: true, status: true, department: true, room: true,
      patient: { select: { name: true, patientCode: true } }, doctor: { select: { name: true } },
    },
    orderBy: [{ scheduledAt: 'desc' }, { id: 'desc' }],
    take,
  });
  return {
    title: 'Appointments',
    columns: [
      col('scheduledAt', 'Scheduled', 'datetime', 17), col('duration', 'Minutes', 'number', 8), col('patient', 'Patient', 'text', 22), col('patientCode', 'Code', 'text', 10),
      col('doctor', 'Doctor', 'text', 18), col('type', 'Type', 'text', 14), col('status', 'Status', 'text', 12), col('department', 'Department', 'text', 14), col('room', 'Room', 'text', 8),
    ],
    rows: rows.map((a): ExportRow => ({
      scheduledAt: a.scheduledAt, duration: a.duration, patient: a.patient.name, patientCode: a.patient.patientCode, doctor: a.doctor.name,
      type: a.type, status: a.status, department: a.department, room: a.room,
    })),
  };
};

const vitals: Loader = async (hospitalId, range, take) => {
  const rows = await prisma.patientVitals.findMany({
    where: { patient: { hospitalId, deletedAt: null }, recordedAt: { gte: range.from, lt: range.to } },
    select: {
      recordedAt: true, heartRate: true, systolicBP: true, diastolicBP: true, spO2: true, temperature: true, respiratoryRate: true, isCritical: true, alertType: true,
      patient: { select: { name: true, patientCode: true, department: true } },
    },
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    take,
  });
  return {
    title: 'Vitals',
    columns: [
      col('recordedAt', 'Recorded', 'datetime', 17), col('patient', 'Patient', 'text', 22), col('patientCode', 'Code', 'text', 10), col('department', 'Department', 'text', 14),
      col('heartRate', 'HR', 'number', 6), col('systolicBP', 'Sys', 'number', 6), col('diastolicBP', 'Dia', 'number', 6), col('spO2', 'SpO2', 'number', 7),
      col('temperature', 'Temp', 'number', 7), col('respiratoryRate', 'RR', 'number', 6), col('isCritical', 'Critical', 'bool', 9), col('alertType', 'Alert', 'text', 20),
    ],
    rows: rows.map((v): ExportRow => ({
      recordedAt: v.recordedAt, patient: v.patient.name, patientCode: v.patient.patientCode, department: v.patient.department,
      heartRate: v.heartRate, systolicBP: v.systolicBP, diastolicBP: v.diastolicBP, spO2: v.spO2, temperature: v.temperature, respiratoryRate: v.respiratoryRate,
      isCritical: v.isCritical, alertType: v.alertType,
    })),
  };
};

const billing: Loader = async (hospitalId, range, take) => {
  const rows = await prisma.invoice.findMany({
    where: { hospitalId, patient: { deletedAt: null }, createdAt: { gte: range.from, lt: range.to } },
    select: {
      number: true, status: true, currency: true, totalMinor: true, discountMinor: true, paidMinor: true, createdAt: true, issuedAt: true,
      patient: { select: { name: true, patientCode: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
  });
  return {
    title: 'Invoices',
    columns: [
      col('number', 'Invoice', 'text', 12), col('status', 'Status', 'text', 9), col('patient', 'Patient', 'text', 22), col('patientCode', 'Code', 'text', 10),
      col('createdAt', 'Created', 'datetime', 17), col('issuedAt', 'Issued', 'datetime', 17), col('currency', 'Currency', 'text', 9),
      col('totalMinor', 'Total', 'money', 11), col('discountMinor', 'Discount', 'money', 11), col('paidMinor', 'Paid', 'money', 11), col('balanceMinor', 'Balance', 'money', 11),
    ],
    rows: rows.map((i): ExportRow => ({
      number: i.number, status: i.status, patient: i.patient.name, patientCode: i.patient.patientCode, createdAt: i.createdAt, issuedAt: i.issuedAt, currency: i.currency,
      totalMinor: i.totalMinor, discountMinor: i.discountMinor, paidMinor: i.paidMinor,
      // A void invoice owes nothing, whatever its lines add up to.
      balanceMinor: i.status === 'VOID' ? 0 : i.totalMinor - i.paidMinor,
    })),
  };
};

export const LOADERS: Record<ExportType, Loader> = { patients, appointments, vitals, billing };
