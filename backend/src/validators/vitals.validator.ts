// backend/src/validators/vitals.validator.ts
import { z } from 'zod';
import { idSchema, looseNumber, digitsString, pageQueryShape } from './common.validator';

const metrics = {
  heartRate: looseNumber(0, 300, { int: true }),
  systolicBP: looseNumber(0, 350, { int: true }),
  diastolicBP: looseNumber(0, 250, { int: true }),
  spO2: looseNumber(0, 100),
  temperature: looseNumber(0, 120), // °C or °F
  respiratoryRate: looseNumber(0, 120, { int: true }),
  notes: z.string().trim().max(2000).nullable().optional(),
};

export const recordVitalsSchema = z.object({ patientId: idSchema, ...metrics });

// recordedBy / isCritical / alertType / patientId are server-controlled and stripped.
export const updateVitalsSchema = z.object(metrics);

export const vitalsQuerySchema = z.object({
  page: pageQueryShape.page,
  patientId: z.string().trim().min(1).optional(),
  critical: z.enum(['true', 'false']).optional(),
  limit: digitsString.optional(),
});

export const vitalsAlertsQuerySchema = z.object({
  department: z.string().trim().min(1).max(100).optional(),
});

// ── Threshold management ──────────────────────────────────────────────
const vitalTypeEnum = z.enum(['HEART_RATE', 'BP_SYSTOLIC', 'BP_DIASTOLIC', 'SPO2', 'TEMPERATURE', 'RESPIRATORY_RATE']);
const limit = z.number().finite().min(0).max(1000).nullable().optional();

// minCritical <= minNormal <= maxNormal <= maxCritical for the limits that are set.
const limitsAreOrdered = (v: { minCritical?: number | null; minNormal?: number | null; maxNormal?: number | null; maxCritical?: number | null }) => {
  const set = [v.minCritical, v.minNormal, v.maxNormal, v.maxCritical].filter((n): n is number => typeof n === 'number');
  return set.every((n, i) => i === 0 || n >= set[i - 1]);
};

export const upsertThresholdSchema = z
  .object({
    department: z.string().trim().min(1).max(100),
    vitalType: vitalTypeEnum,
    minNormal: limit,
    maxNormal: limit,
    minCritical: limit,
    maxCritical: limit,
    alertEnabled: z.boolean().optional(),
    autoNotify: z.boolean().optional(),
  })
  .refine(limitsAreOrdered, { message: 'Limits must satisfy minCritical <= minNormal <= maxNormal <= maxCritical', path: ['minCritical'] });

export const thresholdsQuerySchema = z.object({ department: z.string().trim().min(1).max(100).optional() });
