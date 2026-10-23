// backend/src/validators/patient.validator.ts
import { z } from 'zod';
import { idSchema, nonEmpty, digitsString } from './common.validator';

// Mirrors enums in prisma/schema.prisma.
export const patientStatusEnum = z.enum(['OBSERVATION', 'CRITICAL', 'STABLE', 'DISCHARGED']);
export const genderEnum = z.enum(['MALE', 'FEMALE']);

const MAX_AGE = 150;
const MAX_SHORT_TEXT = 100;
const MAX_LONG_TEXT = 1000;

const isNumericString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v));

const normaliseAge = (v: unknown): unknown => {
  if (v === '') return undefined;
  return isNumericString(v) ? Number(v) : v;
};

// UI sends a number (AdmitPatientModal) or a numeric string (form values); '' -> undefined.
const ageSchema = z.preprocess(
  normaliseAge,
  z.number('age must be a number').int('age must be a whole number').min(0, 'age cannot be negative').max(MAX_AGE, `age must be at most ${MAX_AGE}`)
);

// '' / null mean "not provided" (the form leaves empty selects as '').
const optionalId = z.preprocess((v) => (v === '' || v === null ? undefined : v), idSchema.optional());

const isoDate = z.coerce.date('must be a valid date');

// POST /api/patients/admit. patientCode / status / admissionDate / hospitalId are server-controlled and stripped.
export const admitPatientSchema = z.object({
  name: nonEmpty('name', MAX_SHORT_TEXT),
  age: ageSchema,
  gender: genderEnum,
  department: nonEmpty('department', MAX_SHORT_TEXT),
  diagnosis: nonEmpty('diagnosis', MAX_LONG_TEXT),
  bedId: optionalId,
  doctorId: optionalId,
});

// PUT /api/patients/:id. Whitelist only: patientCode, hospitalId, id, timestamps are stripped.
export const updatePatientSchema = z.object({
  name: nonEmpty('name', MAX_SHORT_TEXT).optional(),
  age: ageSchema.optional(),
  gender: genderEnum.optional(),
  department: nonEmpty('department', MAX_SHORT_TEXT).optional(),
  diagnosis: nonEmpty('diagnosis', MAX_LONG_TEXT).optional(),
  status: patientStatusEnum.optional(),
  bedId: z.union([idSchema, z.null()]).optional(),
  doctorId: z.union([idSchema, z.null()]).optional(),
  admissionDate: isoDate.optional(),
  // null first: z.coerce.date turns null into 1970
  dischargeDate: z.union([z.null(), isoDate]).optional(),
});

// UI filters: status 'All'/'ALL'/'' mean no filter; status is case-insensitive (controller upper-cases).
const normaliseStatusFilter = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  return t === '' || t.toLowerCase() === 'all' ? undefined : t.toUpperCase();
};

// GET /api/patients. page/limit stay strings: the controller parses and clamps them.
export const listPatientsQuerySchema = z.object({
  status: z.preprocess(normaliseStatusFilter, patientStatusEnum.optional()),
  department: z.string().trim().max(MAX_SHORT_TEXT).optional(),
  search: z.string().trim().max(MAX_SHORT_TEXT).optional(),
  page: digitsString.optional(),
  limit: digitsString.optional(),
});

// GET /api/patients/beds/available
export const availableBedsQuerySchema = z.object({
  department: z.string().trim().max(MAX_SHORT_TEXT).optional(),
});

// GET /api/patients/flow. days is coerced and capped so one request can't scan years of rows.
export const patientFlowQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).optional(),
});
