// backend/src/validators/clinical.validator.ts
// hospitalId / authorId / author names / flags are server-controlled and never accepted.
import { z } from 'zod';
import { idSchema, nonEmpty, enumValue, looseNumber, digitsString } from './common.validator';
import { NoteType, PrescriptionStatus, LabPriority, LabOrderStatus } from '@prisma/client';

const text = (label: string, max: number) => nonEmpty(label, max);
const optText = (max: number) => z.string().trim().max(max).nullable().optional();
const trueFalse = z.enum(['true', 'false']);
const page = { page: digitsString.optional(), limit: digitsString.optional() };

// ---- notes ----
export const noteListQuery = z.object({ patientId: idSchema, type: enumValue(NoteType, 'type').optional(), ...page });
export const createNoteSchema = z.object({ patientId: idSchema, type: enumValue(NoteType, 'type'), content: text('content', 10000) });
export const amendNoteSchema = z.object({ content: text('content', 10000) });

// ---- medications ----
export const medicationListQuery = z.object({ active: trueFalse.optional(), q: z.string().trim().max(100).optional(), ...page });
export const createMedicationSchema = z.object({
  name: text('name', 150),
  genericName: optText(150),
  form: text('form', 50),
  strength: text('strength', 50),
});
export const updateMedicationSchema = z.object({
  name: text('name', 150).optional(),
  genericName: optText(150),
  form: text('form', 50).optional(),
  strength: text('strength', 50).optional(),
  active: z.boolean().optional(),
});

// ---- prescriptions ----
export const prescriptionListQuery = z.object({ patientId: idSchema, status: enumValue(PrescriptionStatus, 'status').optional(), ...page });
export const prescriptionItemSchema = z.object({
  medicationId: idSchema,
  dose: text('dose', 100),
  frequency: text('frequency', 100),
  route: optText(50),
  durationDays: looseNumber(1, 3650, { int: true }),
  instructions: optText(500),
});
export const createPrescriptionSchema = z.object({
  patientId: idSchema,
  notes: optText(2000),
  items: z.array(prescriptionItemSchema).min(1, 'at least one item is required').max(20),
});
export const closePrescriptionSchema = z.object({ status: z.enum(['COMPLETED', 'CANCELLED']) });

// ---- lab orders ----
export const labListQuery = z.object({
  patientId: idSchema,
  status: enumValue(LabOrderStatus, 'status').optional(),
  ...page,
});
export const createLabOrderSchema = z.object({
  patientId: idSchema,
  testName: text('testName', 150),
  testCode: optText(50),
  priority: enumValue(LabPriority, 'priority').optional(),
  notes: optText(1000),
});
const limit = looseNumber(-1e9, 1e9);
export const labResultItemSchema = z
  .object({
    analyte: text('analyte', 100),
    value: limit,
    textValue: optText(500),
    unit: optText(30),
    refLow: limit,
    refHigh: limit,
    criticalLow: limit,
    criticalHigh: limit,
  })
  .refine((r) => r.value !== undefined || !!r.textValue, { message: 'a result needs a value or a textValue', path: ['value'] });
export const submitResultsSchema = z.object({ results: z.array(labResultItemSchema).min(1).max(50) });
