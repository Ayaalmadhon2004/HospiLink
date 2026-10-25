import { prismaMock } from '../mocks/prisma';
import { mockRequest, mockResponse } from '../mocks/http';
import { listStock, receiveStock, adjustStock, dispense, listMovements } from '../../src/controllers/pharmacy.controller';

const as = (role: string, over: object = {}) => mockRequest({ user: { id: 'u1', email: 'e', role, hospitalId: 'hosp-1' }, ...over } as any);
const code = (res: any) => res.json.mock.calls[0][0].error?.code;
const tx = () => prismaMock.$transaction.mockImplementation((async (cb: any) => cb(prismaMock)) as any);

beforeEach(() => {
  prismaMock.user.findUnique.mockResolvedValue({ name: 'Pat Pharm' } as any);
  prismaMock.medication.findFirst.mockResolvedValue({ id: 'm1', unitPriceMinor: 250 } as any);
  tx();
});

describe('stock changes', () => {
  it('receive: increments the hospital\'s medication and writes a ledger row with the actor', async () => {
    prismaMock.medication.updateMany.mockResolvedValue({ count: 1 });
    const res = mockResponse();
    await receiveStock(as('ADMIN', { body: { medicationId: 'm1', quantity: 50, note: 'Delivery #7' } }), res);
    expect(prismaMock.medication.updateMany).toHaveBeenCalledWith({ where: { id: 'm1', hospitalId: 'hosp-1' }, data: { stockQuantity: { increment: 50 } } });
    expect(prismaMock.stockMovement.create.mock.calls[0][0].data).toMatchObject({ hospitalId: 'hosp-1', medicationId: 'm1', type: 'RECEIVE', delta: 50, userId: 'u1', userName: 'Pat Pharm' });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('adjust down requires enough on hand in the WHERE clause; 409 INSUFFICIENT_STOCK, no ledger row', async () => {
    prismaMock.medication.updateMany.mockResolvedValue({ count: 0 });
    const res = mockResponse();
    await adjustStock(as('ADMIN', { body: { medicationId: 'm1', delta: -5, note: 'Broken box' } }), res);
    expect(prismaMock.medication.updateMany.mock.calls[0][0].where).toEqual({ id: 'm1', hospitalId: 'hosp-1', stockQuantity: { gte: 5 } });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(code(res)).toBe('INSUFFICIENT_STOCK');
    expect(prismaMock.stockMovement.create).not.toHaveBeenCalled();
  });

  it('404 for a medication of another hospital', async () => {
    prismaMock.medication.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.medication.findFirst.mockResolvedValue(null);
    const res = mockResponse();
    await receiveStock(as('ADMIN', { body: { medicationId: 'foreign', quantity: 5 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('dispense', () => {
  const item = (over: object = {}) => ({ id: 'i1', medicationId: 'm1', prescription: { patientId: 'p1', status: 'ACTIVE' }, medication: { name: 'Para', active: true }, ...over });

  it('takes stock, snapshots the unit price and links the dispensation to the patient (all in one transaction)', async () => {
    prismaMock.prescriptionItem.findFirst.mockResolvedValue(item() as any);
    prismaMock.medication.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.dispensation.create.mockResolvedValue({ id: 'd1' } as any);
    const res = mockResponse();
    await dispense(as('NURSE', { body: { prescriptionItemId: 'i1', quantity: 3 } }), res);
    expect(prismaMock.prescriptionItem.findFirst.mock.calls[0][0].where).toEqual({ id: 'i1', prescription: { hospitalId: 'hosp-1', patient: { deletedAt: null } } });
    expect(prismaMock.medication.updateMany.mock.calls[0][0]).toMatchObject({ where: { stockQuantity: { gte: 3 } }, data: { stockQuantity: { increment: -3 } } });
    expect(prismaMock.dispensation.create.mock.calls[0][0].data).toMatchObject({ hospitalId: 'hosp-1', patientId: 'p1', quantity: 3, unitPriceMinor: 250, dispensedByName: 'Pat Pharm' });
    expect(prismaMock.stockMovement.create.mock.calls[0][0].data).toMatchObject({ type: 'DISPENSE', delta: -3 });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('409 INSUFFICIENT_STOCK leaves no dispensation; 404 unknown item; 409 closed prescription / retired medication', async () => {
    prismaMock.prescriptionItem.findFirst.mockResolvedValue(item() as any);
    prismaMock.medication.updateMany.mockResolvedValue({ count: 0 });
    const a = mockResponse();
    await dispense(as('DOCTOR', { body: { prescriptionItemId: 'i1', quantity: 99 } }), a);
    expect(a.status).toHaveBeenCalledWith(409);
    expect(prismaMock.dispensation.create).not.toHaveBeenCalled();

    prismaMock.prescriptionItem.findFirst.mockResolvedValueOnce(null);
    const b = mockResponse();
    await dispense(as('DOCTOR', { body: { prescriptionItemId: 'x', quantity: 1 } }), b);
    expect(b.status).toHaveBeenCalledWith(404);

    prismaMock.prescriptionItem.findFirst.mockResolvedValueOnce(item({ prescription: { patientId: 'p1', status: 'CANCELLED' } }) as any);
    const c = mockResponse();
    await dispense(as('DOCTOR', { body: { prescriptionItemId: 'i1', quantity: 1 } }), c);
    expect(c.status).toHaveBeenCalledWith(409);

    prismaMock.prescriptionItem.findFirst.mockResolvedValueOnce(item({ medication: { name: 'Old', active: false } }) as any);
    const d = mockResponse();
    await dispense(as('DOCTOR', { body: { prescriptionItemId: 'i1', quantity: 1 } }), d);
    expect(d.status).toHaveBeenCalledWith(409);
  });
});

describe('listing', () => {
  it('stock list: active medications of the hospital; lowOnly compares against reorderLevel', async () => {
    prismaMock.medication.findMany.mockResolvedValue([]);
    prismaMock.medication.count.mockResolvedValue(0);
    await listStock(as('NURSE', { query: { lowOnly: 'true' } }), mockResponse());
    const where = prismaMock.medication.findMany.mock.calls[0][0].where as any;
    expect(where).toMatchObject({ hospitalId: 'hosp-1', active: true });
    expect(where.stockQuantity).toHaveProperty('lte');
  });

  it('movements are hospital-scoped and filterable', async () => {
    prismaMock.stockMovement.findMany.mockResolvedValue([]);
    prismaMock.stockMovement.count.mockResolvedValue(0);
    await listMovements(as('ADMIN', { query: { medicationId: 'm1', type: 'DISPENSE' } }), mockResponse());
    expect(prismaMock.stockMovement.findMany.mock.calls[0][0].where).toEqual({ hospitalId: 'hosp-1', medicationId: 'm1', type: 'DISPENSE' });
  });
});
