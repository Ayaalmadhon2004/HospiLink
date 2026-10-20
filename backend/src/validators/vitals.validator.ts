// backend/src/validators/vitals.validator.ts
import { z } from 'zod';
import { idSchema, looseNumber, digitsString } from './common.validator';

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
  patientId: z.string().trim().min(1).optional(),
  critical: z.enum(['true', 'false']).optional(),
  limit: digitsString.optional(),
});

export const vitalsAlertsQuerySchema = z.object({
  department: z.string().trim().min(1).max(100).optional(),
});
