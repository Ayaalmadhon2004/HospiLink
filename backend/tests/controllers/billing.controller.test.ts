import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import { createInvoice, addLine, removeLine, setDiscount, issueInvoice, addPayment, voidInvoice, getInvoice } from '../../src/controllers/billing.controller';

const as = (over: object = {}) => mockRequest({ user: { id: 'u1', email: 'e', role: 'ADMIN', hospitalId: 'hosp-1' }, ...over } as any);
const code = (res: any) => res.json.mock.calls[0][0].error?.code;
const tx = () => prismaMock.$transaction.mockImplementation((async (cb: any) => cb(prismaMock)) as any);
const found = (over: object = {}) => prismaMock.invoice.findFirst.mockResolvedValue({ id: 'inv1', status: 'DRAFT', lines: [], payments: [], ...over } as any);

beforeEach(() => {
  tx();
  prismaMock.user.findUnique.mockResolvedValue({ name: 'Bill Admin' } as any);
});

describe('createInvoice', () => {
  it('404 for a patient of another hospital', async () => {
    prismaMock.patient.findFirst.mockResolvedValue(null);
    const res = mockResponse();
    await createInvoice(as({ body: { patientId: 'foreign' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(prismaMock.invoice.create).not.toHaveBeenCalled();
  });

  it('pulls unbilled dispensations onto the draft, claims each one, and sets the total', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv1' } as any);
    prismaMock.dispensation.findMany.mockResolvedValue([
      { id: 'd1', quantity: 2, unitPriceMinor: 250, medication: { name: 'Para', form: 'tablet', strength: '500 mg' } },
      { id: 'd2', quantity: 1, unitPriceMinor: 1000, medication: { name: 'Cef', form: 'injection', strength: '1 g' } },
    ] as any);
    prismaMock.invoiceLine.create.mockResolvedValueOnce({ id: 'l1' } as any).mockResolvedValueOnce({ id: 'l2' } as any);
    prismaMock.dispensation.updateMany.mockResolvedValue({ count: 1 });
    found();
    const res = mockResponse();
    await createInvoice(as({ body: { patientId: 'p1', includeDispensations: true } }), res);
    expect(prismaMock.dispensation.findMany.mock.calls[0][0].where).toEqual({ hospitalId: 'hosp-1', patientId: 'p1', invoiceLineId: null });
    expect(prismaMock.dispensation.updateMany).toHaveBeenCalledWith({ where: { id: 'd1', invoiceLineId: null }, data: { invoiceLineId: 'l1' } });
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({ where: { id: 'inv1' }, data: { totalMinor: 1500 } });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('409 (rolled back) when a dispensation was billed by someone else meanwhile', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
    prismaMock.invoice.create.mockResolvedValue({ id: 'inv1' } as any);
    prismaMock.dispensation.findMany.mockResolvedValue([{ id: 'd1', quantity: 1, unitPriceMinor: 1, medication: { name: 'a', form: 'b', strength: 'c' } }] as any);
    prismaMock.invoiceLine.create.mockResolvedValue({ id: 'l1' } as any);
    prismaMock.dispensation.updateMany.mockResolvedValue({ count: 0 });
    const res = mockResponse();
    await createInvoice(as({ body: { patientId: 'p1', includeDispensations: true } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
  });
});

describe('draft editing', () => {
  it('addLine: total = quantity x unit price, applied by a DRAFT-guarded UPDATE', async () => {
    found();
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.invoiceLine.create.mockResolvedValue({} as any);
    const res = mockResponse();
    await addLine(as({ params: { id: 'inv1' }, body: { description: 'Consultation', quantity: 3, unitPriceMinor: 4000 } }), res);
    expect(prismaMock.invoice.updateMany).toHaveBeenCalledWith({ where: { id: 'inv1', hospitalId: 'hosp-1', status: 'DRAFT' }, data: { totalMinor: { increment: 12000 } } });
    expect(prismaMock.invoiceLine.create.mock.calls[0][0].data).toMatchObject({ quantity: 3, unitPriceMinor: 4000, totalMinor: 12000 });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('addLine on an issued invoice -> 409 INVOICE_NOT_EDITABLE and no line', async () => {
    found({ status: 'ISSUED' });
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 0 });
    const res = mockResponse();
    await addLine(as({ params: { id: 'inv1' }, body: { description: 'x', quantity: 1, unitPriceMinor: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(code(res)).toBe('INVOICE_NOT_EDITABLE');
    expect(prismaMock.invoiceLine.create).not.toHaveBeenCalled();
  });

  it('removeLine: 404 unknown line; draft-guarded decrement; explains when the discount blocks it', async () => {
    prismaMock.invoiceLine.findFirst.mockResolvedValueOnce(null);
    const a = mockResponse();
    await removeLine(as({ params: { id: 'inv1', lineId: 'zz' } }), a);
    expect(a.status).toHaveBeenCalledWith(404);

    prismaMock.invoiceLine.findFirst.mockResolvedValue({ id: 'l1', totalMinor: 500 } as any);
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.invoice.findFirst.mockResolvedValueOnce({ status: 'DRAFT' } as any);
    const b = mockResponse();
    await removeLine(as({ params: { id: 'inv1', lineId: 'l1' } }), b);
    expect(prismaMock.invoice.updateMany.mock.calls[0][0].where).toEqual({ id: 'inv1', hospitalId: 'hosp-1', status: 'DRAFT', totalMinor: { gte: 500 } });
    expect(b.status).toHaveBeenCalledWith(409);
    expect(prismaMock.invoiceLine.delete).not.toHaveBeenCalled();
  });

  it('setDiscount: cannot exceed the subtotal; otherwise recomputes the total optimistically', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({ status: 'DRAFT', discountMinor: 100, totalMinor: 900, lines: [], payments: [] } as any);
    const tooBig = mockResponse();
    await setDiscount(as({ params: { id: 'inv1' }, body: { discountMinor: 1001 } }), tooBig);
    expect(tooBig.status).toHaveBeenCalledWith(400);

    prismaMock.invoice.updateMany.mockResolvedValue({ count: 1 });
    const okRes = mockResponse();
    await setDiscount(as({ params: { id: 'inv1' }, body: { discountMinor: 300 } }), okRes);
    expect(prismaMock.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv1', hospitalId: 'hosp-1', status: 'DRAFT', discountMinor: 100, totalMinor: 900 },
      data: { discountMinor: 300, totalMinor: 700 },
    });

    prismaMock.invoice.updateMany.mockResolvedValue({ count: 0 });
    const raced = mockResponse();
    await setDiscount(as({ params: { id: 'inv1' }, body: { discountMinor: 300 } }), raced);
    expect(raced.status).toHaveBeenCalledWith(409);
  });

  it('draft edits on a missing/other-hospital invoice -> 404', async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null);
    for (const fn of [getInvoice, issueInvoice, voidInvoice]) {
      const res = mockResponse();
      await fn(as({ params: { id: 'x' } }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    }
  });
});

describe('issue', () => {
  it('assigns the next number from the hospital counter inside the transaction, guarded by DRAFT + at least one line', async () => {
    found();
    prismaMock.hospital.update.mockResolvedValue({ invoiceSeq: 42 } as any);
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 1 });
    const res = mockResponse();
    await issueInvoice(as({ params: { id: 'inv1' } }), res);
    expect(prismaMock.hospital.update).toHaveBeenCalledWith({ where: { id: 'hosp-1' }, data: { invoiceSeq: { increment: 1 } }, select: { invoiceSeq: true } });
    const first = prismaMock.invoice.updateMany.mock.calls[0][0] as any;
    expect(first.where).toEqual({ id: 'inv1', hospitalId: 'hosp-1', status: 'DRAFT', lines: { some: {} } });
    expect(first.data).toMatchObject({ status: 'ISSUED', number: 'INV-000042' });
  });

  it('409 when not a draft or without lines (the transaction rolls the counter back)', async () => {
    found();
    prismaMock.hospital.update.mockResolvedValue({ invoiceSeq: 43 } as any);
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 0 });
    const res = mockResponse();
    await issueInvoice(as({ params: { id: 'inv1' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe('payments', () => {
  const issued = () => prismaMock.invoice.findFirst.mockResolvedValue({ id: 'inv1', status: 'ISSUED', totalMinor: 1000, paidMinor: 0, lines: [], payments: [] } as any);

  it('records a payment; the UPDATE itself guards ISSUED and paid + amount <= total', async () => {
    issued();
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.payment.create.mockResolvedValue({} as any);
    const res = mockResponse();
    await addPayment(as({ params: { id: 'inv1' }, body: { amountMinor: 400, method: 'CASH', reference: 'R1' } }), res);
    expect(prismaMock.invoice.updateMany.mock.calls[0][0]).toEqual({ where: { id: 'inv1', hospitalId: 'hosp-1', status: 'ISSUED', paidMinor: { lte: 600 } }, data: { paidMinor: { increment: 400 } } });
    expect(prismaMock.payment.create.mock.calls[0][0].data).toMatchObject({ amountMinor: 400, method: 'CASH', receivedByName: 'Bill Admin', hospitalId: 'hosp-1' });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('409 OVERPAYMENT when it would exceed the balance or the invoice is not open; nothing recorded', async () => {
    issued();
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 0 });
    const res = mockResponse();
    await addPayment(as({ params: { id: 'inv1' }, body: { amountMinor: 5000, method: 'CARD' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(code(res)).toBe('OVERPAYMENT');
    expect(prismaMock.payment.create).not.toHaveBeenCalled();
  });
});

describe('void', () => {
  it('only unpaid DRAFT/ISSUED; releases the dispensed lines for re-billing', async () => {
    found();
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 1 });
    const res = mockResponse();
    await voidInvoice(as({ params: { id: 'inv1' } }), res);
    expect(prismaMock.invoice.updateMany.mock.calls[0][0].where).toEqual({ id: 'inv1', hospitalId: 'hosp-1', status: { in: ['DRAFT', 'ISSUED'] }, paidMinor: 0 });
    expect(prismaMock.dispensation.updateMany).toHaveBeenCalledWith({ where: { invoiceLine: { invoiceId: 'inv1' } }, data: { invoiceLineId: null } });
  });

  it('409 when payments exist or it is already paid/void; dispensations stay untouched', async () => {
    found({ status: 'PAID' });
    prismaMock.invoice.updateMany.mockResolvedValue({ count: 0 });
    const res = mockResponse();
    await voidInvoice(as({ params: { id: 'inv1' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prismaMock.dispensation.updateMany).not.toHaveBeenCalled();
  });
});
