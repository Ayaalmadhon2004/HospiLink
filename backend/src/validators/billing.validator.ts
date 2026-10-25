// backend/src/validators/billing.validator.ts
// Money is an integer in minor units; hospitalId, number, status, totals and paid amounts are server-controlled.
import { z } from 'zod';
import { idSchema, nonEmpty, enumValue, digitsString } from './common.validator';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';

const minor = z.coerce.number().int().min(0).max(1_000_000_000);
const page = { page: digitsString.optional(), limit: digitsString.optional() };

export const invoiceListQuery = z.object({ patientId: idSchema.optional(), status: enumValue(InvoiceStatus, 'status').optional(), ...page });
export const createInvoiceSchema = z.object({
  patientId: idSchema,
  // Pull the patient's not-yet-billed dispensed medications onto the draft.
  includeDispensations: z.boolean().optional(),
});
export const addLineSchema = z.object({
  description: nonEmpty('description', 200),
  quantity: z.coerce.number().int().min(1).max(100_000),
  unitPriceMinor: minor,
});
export const lineParams = z.object({ id: idSchema, lineId: idSchema });
export const discountSchema = z.object({ discountMinor: minor });
export const paymentSchema = z.object({
  amountMinor: z.coerce.number().int().min(1).max(1_000_000_000),
  method: enumValue(PaymentMethod, 'method'),
  reference: z.string().trim().max(100).nullable().optional(),
});
export const patientLookupQuery = z.object({ q: z.string().trim().max(100).optional() });
