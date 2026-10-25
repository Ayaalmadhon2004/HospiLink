// backend/src/validators/devices.validator.ts
import { z } from 'zod';

export const createDeviceKeySchema = z.object({ name: z.string().trim().min(1).max(100) });
export const ingestParams = z.object({ protocol: z.enum(['hl7', 'fhir', 'json']) });
