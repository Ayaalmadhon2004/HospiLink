import { Request, Response } from 'express';
import type { Prisma, InvoiceStatus } from '@prisma/client';
import prisma from '../config/db';
import logger from '../config/logger';
import { hospitalIdOf } from '../utils/tenant';
import { pageParams, pageInfo } from '../utils/pagination';
import { ok, fail } from '../utils/apiResponse';
import { actorOf, findTenantPatient } from '../services/clinicalAccess';

// Thrown inside a transaction to roll it back and answer with a specific HTTP error.
class BillingError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
const notEditable = () => new BillingError(409, 'INVOICE_NOT_EDITABLE', 'Only a draft invoice can be changed');

const FULL = {
  patient: { select: { id: true, name: true, patientCode: true } },
  lines: { orderBy: { id: 'asc' as const } },
  payments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.InvoiceInclude;

const handle = (res: Response, error: unknown, label: string): Response => {
  if (error instanceof BillingError) return fail(res, error.status, error.code, error.message);
  logger.error({ err: error }, `${label} error:`);
  return fail(res, 500, 'INTERNAL_ERROR', `Failed to ${label}`);
};

const loadInvoice = (id: string, hospitalId: string) => prisma.invoice.findFirst({ where: { id, hospitalId, patient: { deletedAt: null } }, include: FULL });

// GET /api/billing/invoices
export const listInvoices = async (req: Request, res: Response) => {
  try {
    const q = req.query as { patientId?: string; status?: InvoiceStatus };
    const where: Prisma.InvoiceWhereInput = { hospitalId: hospitalIdOf(req), patient: { deletedAt: null }, ...(q.patientId ? { patientId: q.patientId } : {}), ...(q.status ? { status: q.status } : {}) };
    const page = pageParams(req.query);
    const [rows, totalCount] = await Promise.all([
      prisma.invoice.findMany({ where, include: { patient: FULL.patient }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page.skip, take: page.take }),
      prisma.invoice.count({ where }),
    ]);
    return ok(res, rows, { count: rows.length, pagination: pageInfo(page, totalCount) });
  } catch (error: unknown) {
    return handle(res, error, 'load invoices');
  }
};

// GET /api/billing/invoices/:id
export const getInvoice = async (req: Request, res: Response) => {
  try {
    const invoice = await loadInvoice(req.params.id as string, hospitalIdOf(req));
    return invoice ? ok(res, invoice) : fail(res, 404, 'NOT_FOUND', 'Invoice not found');
  } catch (error: unknown) {
    return handle(res, error, 'load invoice');
  }
};

// POST /api/billing/invoices - a DRAFT, optionally pre-filled with the patient's unbilled dispensations
export const createInvoice = async (req: Request, res: Response) => {
  try {
    const { patientId, includeDispensations } = req.body as { patientId: string; includeDispensations?: boolean };
    const hospitalId = hospitalIdOf(req);
    if (!(await findTenantPatient(req, patientId))) return fail(res, 404, 'PATIENT_NOT_FOUND', 'Patient not found');

    const id = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({ data: { hospitalId, patientId } });
      if (!includeDispensations) return invoice.id;
      const unbilled = await tx.dispensation.findMany({
        where: { hospitalId, patientId, invoiceLineId: null },
        include: { medication: { select: { name: true, form: true, strength: true } } },
        orderBy: { createdAt: 'asc' },
      });
      let total = 0;
      for (const d of unbilled) {
        const lineTotal = d.quantity * d.unitPriceMinor;
        const line = await tx.invoiceLine.create({
          data: { invoiceId: invoice.id, description: `${d.medication.name} ${d.medication.strength} (${d.medication.form})`, quantity: d.quantity, unitPriceMinor: d.unitPriceMinor, totalMinor: lineTotal },
        });
        // Claim the dispensation: if another draft grabbed it meanwhile, abort instead of billing it twice.
        const { count } = await tx.dispensation.updateMany({ where: { id: d.id, invoiceLineId: null }, data: { invoiceLineId: line.id } });
        if (count === 0) throw new BillingError(409, 'CONFLICT', 'A dispensation was billed by another invoice, please retry');
        total += lineTotal;
      }
      await tx.invoice.update({ where: { id: invoice.id }, data: { totalMinor: total } });
      return invoice.id;
    });
    return ok(res, await loadInvoice(id, hospitalId), {}, 201);
  } catch (error: unknown) {
    return handle(res, error, 'create invoice');
  }
};

// POST /api/billing/invoices/:id/lines
export const addLine = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const hospitalId = hospitalIdOf(req);
    const { description, quantity, unitPriceMinor } = req.body as { description: string; quantity: number; unitPriceMinor: number };
    const totalMinor = quantity * unitPriceMinor;
    if (!(await loadInvoice(id, hospitalId))) return fail(res, 404, 'NOT_FOUND', 'Invoice not found');
    await prisma.$transaction(async (tx) => {
      // Locks the row and proves it is still a draft in one statement, so a concurrent issue cannot slip a line in.
      const { count } = await tx.invoice.updateMany({ where: { id, hospitalId, status: 'DRAFT' }, data: { totalMinor: { increment: totalMinor } } });
      if (count === 0) throw notEditable();
      await tx.invoiceLine.create({ data: { invoiceId: id, description, quantity, unitPriceMinor, totalMinor } });
    });
    return ok(res, await loadInvoice(id, hospitalId), {}, 201);
  } catch (error: unknown) {
    return handle(res, error, 'add invoice line');
  }
};

// DELETE /api/billing/invoices/:id/lines/:lineId - a dispensed line becomes billable again (FK SetNull)
export const removeLine = async (req: Request, res: Response) => {
  try {
    const { id, lineId } = req.params as { id: string; lineId: string };
    const hospitalId = hospitalIdOf(req);
    const line = await prisma.invoiceLine.findFirst({ where: { id: lineId, invoiceId: id, invoice: { hospitalId } }, select: { id: true, totalMinor: true } });
    if (!line) return fail(res, 404, 'NOT_FOUND', 'Invoice line not found');
    await prisma.$transaction(async (tx) => {
      // total >= line total keeps "discount <= subtotal"; otherwise the discount has to be lowered first.
      const { count } = await tx.invoice.updateMany({ where: { id, hospitalId, status: 'DRAFT', totalMinor: { gte: line.totalMinor } }, data: { totalMinor: { decrement: line.totalMinor } } });
      if (count === 0) {
        const inv = await tx.invoice.findFirst({ where: { id, hospitalId }, select: { status: true } });
        throw inv?.status === 'DRAFT' ? new BillingError(409, 'CONFLICT', 'Lower the discount before removing this line') : notEditable();
      }
      await tx.invoiceLine.delete({ where: { id: lineId } });
    });
    return ok(res, await loadInvoice(id, hospitalId));
  } catch (error: unknown) {
    return handle(res, error, 'remove invoice line');
  }
};

// PUT /api/billing/invoices/:id/discount (DRAFT only). discount <= subtotal, so the total never goes negative.
export const setDiscount = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const hospitalId = hospitalIdOf(req);
    const { discountMinor } = req.body as { discountMinor: number };
    const inv = await prisma.invoice.findFirst({ where: { id, hospitalId, patient: { deletedAt: null } }, select: { status: true, discountMinor: true, totalMinor: true } });
    if (!inv) return fail(res, 404, 'NOT_FOUND', 'Invoice not found');
    if (inv.status !== 'DRAFT') throw notEditable();
    const subtotal = inv.totalMinor + inv.discountMinor;
    if (discountMinor > subtotal) return fail(res, 400, 'VALIDATION_ERROR', 'The discount cannot exceed the invoice subtotal');
    // Optimistic: only applies if nobody changed the draft since we read it.
    const { count } = await prisma.invoice.updateMany({
      where: { id, hospitalId, status: 'DRAFT', discountMinor: inv.discountMinor, totalMinor: inv.totalMinor },
      data: { discountMinor, totalMinor: subtotal - discountMinor },
    });
    if (count === 0) return fail(res, 409, 'CONFLICT', 'The invoice changed meanwhile, please retry');
    return ok(res, await loadInvoice(id, hospitalId));
  } catch (error: unknown) {
    return handle(res, error, 'set discount');
  }
};

// POST /api/billing/invoices/:id/issue - DRAFT -> ISSUED with the next gap-free number; frozen from now on
export const issueInvoice = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const hospitalId = hospitalIdOf(req);
    if (!(await loadInvoice(id, hospitalId))) return fail(res, 404, 'NOT_FOUND', 'Invoice not found');
    await prisma.$transaction(async (tx) => {
      const { invoiceSeq } = await tx.hospital.update({ where: { id: hospitalId }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true } });
      const { count } = await tx.invoice.updateMany({
        where: { id, hospitalId, status: 'DRAFT', lines: { some: {} } },
        data: { status: 'ISSUED', number: `INV-${String(invoiceSeq).padStart(6, '0')}`, issuedAt: new Date() },
      });
      // Throwing rolls the counter back too, so a refused issue never burns a number.
      if (count === 0) throw new BillingError(409, 'INVOICE_NOT_EDITABLE', 'Only a draft invoice with at least one line can be issued');
      // A zero-value invoice (fully discounted) has nothing to collect.
      await tx.invoice.updateMany({ where: { id, hospitalId, totalMinor: 0 }, data: { status: 'PAID' } });
    });
    return ok(res, await loadInvoice(id, hospitalId));
  } catch (error: unknown) {
    return handle(res, error, 'issue invoice');
  }
};

// POST /api/billing/invoices/:id/payments - partial payments allowed; PAID when they add up to the total
export const addPayment = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const hospitalId = hospitalIdOf(req);
    const { amountMinor, method, reference } = req.body as { amountMinor: number; method: 'CASH' | 'CARD' | 'INSURANCE' | 'TRANSFER'; reference?: string | null };
    if (!(await loadInvoice(id, hospitalId))) return fail(res, 404, 'NOT_FOUND', 'Invoice not found');
    const user = await actorOf(req);
    await prisma.$transaction(async (tx) => {
      // "paid + amount <= total" and "still ISSUED" are checked by the UPDATE itself: concurrent payments cannot overpay.
      const inv = await tx.invoice.findFirst({ where: { id, hospitalId }, select: { totalMinor: true } });
      const { count } = await tx.invoice.updateMany({
        where: { id, hospitalId, status: 'ISSUED', paidMinor: { lte: (inv?.totalMinor ?? 0) - amountMinor } },
        data: { paidMinor: { increment: amountMinor } },
      });
      if (count === 0) throw new BillingError(409, 'OVERPAYMENT', 'The invoice is not open for payment or the amount exceeds the balance');
      await tx.payment.create({ data: { invoiceId: id, hospitalId, amountMinor, method, reference: reference ?? null, receivedById: user.id, receivedByName: user.name } });
      await tx.invoice.updateMany({ where: { id, hospitalId, status: 'ISSUED', totalMinor: { equals: (inv?.totalMinor ?? 0) }, paidMinor: { equals: (inv?.totalMinor ?? 0) } }, data: { status: 'PAID' } });
    });
    return ok(res, await loadInvoice(id, hospitalId), {}, 201);
  } catch (error: unknown) {
    return handle(res, error, 'record payment');
  }
};

// POST /api/billing/invoices/:id/void - DRAFT or ISSUED with nothing paid. Dispensed lines become billable again.
export const voidInvoice = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const hospitalId = hospitalIdOf(req);
    if (!(await loadInvoice(id, hospitalId))) return fail(res, 404, 'NOT_FOUND', 'Invoice not found');
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.invoice.updateMany({ where: { id, hospitalId, status: { in: ['DRAFT', 'ISSUED'] }, paidMinor: 0 }, data: { status: 'VOID', voidedAt: new Date() } });
      if (count === 0) throw new BillingError(409, 'CONFLICT', 'Only an unpaid draft or issued invoice can be voided');
      await tx.dispensation.updateMany({ where: { invoiceLine: { invoiceId: id } }, data: { invoiceLineId: null } });
    });
    return ok(res, await loadInvoice(id, hospitalId));
  } catch (error: unknown) {
    return handle(res, error, 'void invoice');
  }
};
