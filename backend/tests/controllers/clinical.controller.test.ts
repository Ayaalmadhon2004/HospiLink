import { Prisma } from '@prisma/client';
import { prismaMock } from '../mocks/prisma';
import '../mocks/io';
import { mockRequest, mockResponse } from '../mocks/http';
import { listNotes, noteHistory, createNote, amendNote } from '../../src/controllers/clinicalNotes.controller';
import { createMedication, updateMedication, listMedications } from '../../src/controllers/medications.controller';
import { createPrescription, closePrescription } from '../../src/controllers/prescriptions.controller';
import { createLabOrder, submitResults, cancelLabOrder } from '../../src/controllers/labOrders.controller';

jest.mock('../../src/services/notification.service', () => ({ notify: jest.fn().mockResolvedValue([]) }));
import { notify } from '../../src/services/notification.service';

const as = (role: string, over: object = {}) => mockRequest({ user: { id: 'u1', email: 'e', role, hospitalId: 'hosp-1' }, ...over } as any);
const body = (res: any) => res.json.mock.calls[0][0];
const P2002 = () => new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });

beforeEach(() => {
  prismaMock.user.findUnique.mockResolvedValue({ name: 'Dr Who' } as any);
});

describe('clinical notes', () => {
  it('list: scoped to hospital + patient, current versions only, patient not soft-deleted', async () => {
    prismaMock.clinicalNote.findMany.mockResolvedValue([]);
    prismaMock.clinicalNote.count.mockResolvedValue(0);
    await listNotes(as('NURSE', { query: { patientId: 'p1' } }), mockResponse());
    expect(prismaMock.clinicalNote.findMany.mock.calls[0][0].where).toEqual({ hospitalId: 'hosp-1', patientId: 'p1', patient: { deletedAt: null }, amendment: null });
  });

  it('a DOCTOR writes any type; the note records author id and name snapshot in the caller hospital', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
    prismaMock.clinicalNote.create.mockResolvedValue({ id: 'n1' } as any);
    const res = mockResponse();
    await createNote(as('DOCTOR', { body: { patientId: 'p1', type: 'PROGRESS', content: 'Stable' } }), res);
    expect(prismaMock.patient.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'p1', hospitalId: 'hosp-1', deletedAt: null } }));
    expect(prismaMock.clinicalNote.create.mock.calls[0][0].data).toEqual({ hospitalId: 'hosp-1', patientId: 'p1', type: 'PROGRESS', content: 'Stable', authorId: 'u1', authorName: 'Dr Who' });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('a NURSE may only write NURSING notes (403 otherwise, nothing stored)', async () => {
    const res = mockResponse();
    await createNote(as('NURSE', { body: { patientId: 'p1', type: 'PROGRESS', content: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(prismaMock.clinicalNote.create).not.toHaveBeenCalled();
    prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
    prismaMock.clinicalNote.create.mockResolvedValue({ id: 'n' } as any);
    const ok = mockResponse();
    await createNote(as('NURSE', { body: { patientId: 'p1', type: 'NURSING', content: 'x' } }), ok);
    expect(ok.status).toHaveBeenCalledWith(201);
  });

  it('404 for a patient of another hospital', async () => {
    prismaMock.patient.findFirst.mockResolvedValue(null);
    const res = mockResponse();
    await createNote(as('DOCTOR', { body: { patientId: 'foreign', type: 'PROGRESS', content: 'x' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('amend: appends a new row superseding the original (type inherited) and never updates the original', async () => {
    prismaMock.clinicalNote.findFirst.mockResolvedValue({ id: 'n1', patientId: 'p1', type: 'PROGRESS', amendment: null } as any);
    prismaMock.clinicalNote.create.mockResolvedValue({ id: 'n2' } as any);
    const res = mockResponse();
    await amendNote(as('DOCTOR', { params: { id: 'n1' }, body: { content: 'Corrected' } }), res);
    expect(prismaMock.clinicalNote.create.mock.calls[0][0].data).toMatchObject({ supersedesId: 'n1', type: 'PROGRESS', patientId: 'p1', content: 'Corrected' });
    expect(prismaMock.clinicalNote.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('amend: 404 other hospital, 403 nurse on a doctor note, 409 already amended or lost the race (P2002)', async () => {
    prismaMock.clinicalNote.findFirst.mockResolvedValueOnce(null);
    const a = mockResponse();
    await amendNote(as('DOCTOR', { params: { id: 'x' }, body: { content: 'c' } }), a);
    expect(a.status).toHaveBeenCalledWith(404);

    prismaMock.clinicalNote.findFirst.mockResolvedValueOnce({ id: 'n1', patientId: 'p', type: 'PROGRESS', amendment: null } as any);
    const b = mockResponse();
    await amendNote(as('NURSE', { params: { id: 'n1' }, body: { content: 'c' } }), b);
    expect(b.status).toHaveBeenCalledWith(403);

    prismaMock.clinicalNote.findFirst.mockResolvedValueOnce({ id: 'n1', patientId: 'p', type: 'PROGRESS', amendment: { id: 'n2' } } as any);
    const c = mockResponse();
    await amendNote(as('DOCTOR', { params: { id: 'n1' }, body: { content: 'c' } }), c);
    expect(c.status).toHaveBeenCalledWith(409);

    prismaMock.clinicalNote.findFirst.mockResolvedValueOnce({ id: 'n1', patientId: 'p', type: 'PROGRESS', amendment: null } as any);
    prismaMock.clinicalNote.create.mockRejectedValue(P2002());
    const d = mockResponse();
    await amendNote(as('DOCTOR', { params: { id: 'n1' }, body: { content: 'c' } }), d);
    expect(d.status).toHaveBeenCalledWith(409);
  });

  it('history walks the supersedes chain newest -> oldest, scoped to the hospital', async () => {
    prismaMock.clinicalNote.findFirst
      .mockResolvedValueOnce({ id: 'n2', supersedesId: 'n1' } as any)
      .mockResolvedValueOnce({ id: 'n1', supersedesId: null } as any);
    const res = mockResponse();
    await noteHistory(as('DOCTOR', { params: { id: 'n2' } }), res);
    expect(body(res).data.map((n: any) => n.id)).toEqual(['n2', 'n1']);
    expect(prismaMock.clinicalNote.findFirst.mock.calls[0][0].where).toMatchObject({ hospitalId: 'hosp-1' });
    prismaMock.clinicalNote.findFirst.mockResolvedValue(null);
    const none = mockResponse();
    await noteHistory(as('DOCTOR', { params: { id: 'zzz' } }), none);
    expect(none.status).toHaveBeenCalledWith(404);
  });
});

describe('medications', () => {
  it('creates in the caller hospital; duplicate -> 409', async () => {
    prismaMock.medication.create.mockResolvedValue({ id: 'm1' } as any);
    const res = mockResponse();
    await createMedication(as('DOCTOR', { body: { name: 'Paracetamol', form: 'tablet', strength: '500 mg', hospitalId: 'evil' } }), res);
    expect(prismaMock.medication.create.mock.calls[0][0].data).toMatchObject({ hospitalId: 'hosp-1', name: 'Paracetamol' });
    expect(res.status).toHaveBeenCalledWith(201);
    prismaMock.medication.create.mockRejectedValue(P2002());
    const dup = mockResponse();
    await createMedication(as('DOCTOR', { body: { name: 'Paracetamol', form: 'tablet', strength: '500 mg' } }), dup);
    expect(dup.status).toHaveBeenCalledWith(409);
  });

  it('update: 404 for another hospital; retire with active=false', async () => {
    prismaMock.medication.findFirst.mockResolvedValueOnce(null);
    const a = mockResponse();
    await updateMedication(as('ADMIN', { params: { id: 'x' }, body: { active: false } }), a);
    expect(a.status).toHaveBeenCalledWith(404);
    prismaMock.medication.findFirst.mockResolvedValueOnce({ id: 'm1' } as any);
    prismaMock.medication.update.mockResolvedValue({ id: 'm1', active: false } as any);
    const b = mockResponse();
    await updateMedication(as('ADMIN', { params: { id: 'm1' }, body: { active: false } }), b);
    expect(prismaMock.medication.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { active: false } });
  });

  it('list is hospital-scoped and searches name/generic name', async () => {
    prismaMock.medication.findMany.mockResolvedValue([]);
    prismaMock.medication.count.mockResolvedValue(0);
    await listMedications(as('NURSE', { query: { q: 'para', active: 'true' } }), mockResponse());
    const where = prismaMock.medication.findMany.mock.calls[0][0].where as any;
    expect(where.hospitalId).toBe('hosp-1');
    expect(where.active).toBe(true);
    expect(where.OR).toHaveLength(2);
  });
});

describe('prescriptions', () => {
  const rxBody = { patientId: 'p1', items: [{ medicationId: 'm1', dose: '1 tab', frequency: 'TID' }, { medicationId: 'm1', dose: '2 tab', frequency: 'QD' }] };

  it('rejects medications that are unknown, inactive or from another hospital (400, nothing stored)', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
    prismaMock.medication.count.mockResolvedValue(0);
    const res = mockResponse();
    await createPrescription(as('DOCTOR', { body: rxBody }), res);
    expect(prismaMock.medication.count).toHaveBeenCalledWith({ where: { id: { in: ['m1'] }, hospitalId: 'hosp-1', active: true } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prismaMock.prescription.create).not.toHaveBeenCalled();
  });

  it('creates the prescription with its items and the prescriber snapshot', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
    prismaMock.medication.count.mockResolvedValue(1);
    prismaMock.prescription.create.mockResolvedValue({ id: 'rx1' } as any);
    const res = mockResponse();
    await createPrescription(as('DOCTOR', { body: rxBody }), res);
    const data = prismaMock.prescription.create.mock.calls[0][0].data as any;
    expect(data).toMatchObject({ hospitalId: 'hosp-1', patientId: 'p1', prescriberId: 'u1', prescriberName: 'Dr Who' });
    expect(data.items.create).toHaveLength(2);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('404 for a patient of another hospital', async () => {
    prismaMock.patient.findFirst.mockResolvedValue(null);
    const res = mockResponse();
    await createPrescription(as('DOCTOR', { body: rxBody }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('close: ACTIVE-only in the WHERE clause; 409 when already closed; 404 other hospital', async () => {
    prismaMock.prescription.findFirst.mockResolvedValueOnce(null);
    const a = mockResponse();
    await closePrescription(as('DOCTOR', { params: { id: 'x' }, body: { status: 'CANCELLED' } }), a);
    expect(a.status).toHaveBeenCalledWith(404);

    prismaMock.prescription.findFirst.mockResolvedValue({ id: 'rx1' } as any);
    prismaMock.prescription.updateMany.mockResolvedValueOnce({ count: 0 });
    const b = mockResponse();
    await closePrescription(as('DOCTOR', { params: { id: 'rx1' }, body: { status: 'COMPLETED' } }), b);
    expect(prismaMock.prescription.updateMany.mock.calls[0][0].where).toEqual({ id: 'rx1', hospitalId: 'hosp-1', status: 'ACTIVE' });
    expect(b.status).toHaveBeenCalledWith(409);

    prismaMock.prescription.updateMany.mockResolvedValueOnce({ count: 1 });
    const c = mockResponse();
    await closePrescription(as('DOCTOR', { params: { id: 'rx1' }, body: { status: 'COMPLETED' } }), c);
    expect(c.status).not.toHaveBeenCalledWith(409);
  });
});

describe('lab orders', () => {
  const order = { id: 'l1', testName: 'CBC', patient: { id: 'p1', name: 'Ali', department: 'ICU', hospitalId: 'hosp-1', doctor: { userId: 'doc1' } } };

  it('creates an order in the caller hospital for a tenant patient', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({ id: 'p1' } as any);
    prismaMock.labOrder.create.mockResolvedValue({ id: 'l1' } as any);
    const res = mockResponse();
    await createLabOrder(as('DOCTOR', { body: { patientId: 'p1', testName: 'CBC', priority: 'STAT' } }), res);
    expect(prismaMock.labOrder.create.mock.calls[0][0].data).toMatchObject({ hospitalId: 'hosp-1', orderedById: 'u1', orderedByName: 'Dr Who', priority: 'STAT' });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  const withTx = (count: number) =>
    prismaMock.$transaction.mockImplementation((async (cb: any) => cb({ labOrder: { updateMany: jest.fn().mockResolvedValue({ count }) }, labResult: prismaMock.labResult })) as any);

  it('computes flags server-side (ignores a client flag) and notifies on a critical result', async () => {
    prismaMock.labOrder.findFirst.mockResolvedValue(order as any);
    withTx(1);
    prismaMock.labResult.createMany.mockResolvedValue({ count: 2 });
    const res = mockResponse();
    await submitResults(as('NURSE', { params: { id: 'l1' }, body: { results: [
      { analyte: 'Hb', value: 5, refLow: 12, refHigh: 17, criticalLow: 7, flag: 'NORMAL' },
      { analyte: 'WBC', value: 8, refLow: 4, refHigh: 11 },
    ] } }), res);
    const rows = (prismaMock.labResult.createMany.mock.calls[0][0] as any).data;
    expect(rows.map((r: any) => r.flag)).toEqual(['CRITICAL_LOW', 'NORMAL']);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipients: expect.objectContaining({ hospitalId: 'hosp-1', userIds: ['doc1'], department: 'ICU' }) }));
  });

  it('409 and no results stored when the order is not ORDERED any more; 404 other hospital', async () => {
    prismaMock.labOrder.findFirst.mockResolvedValueOnce(null);
    const a = mockResponse();
    await submitResults(as('DOCTOR', { params: { id: 'x' }, body: { results: [{ analyte: 'Hb', value: 1 }] } }), a);
    expect(a.status).toHaveBeenCalledWith(404);

    prismaMock.labOrder.findFirst.mockResolvedValueOnce(order as any);
    withTx(0);
    const b = mockResponse();
    await submitResults(as('DOCTOR', { params: { id: 'l1' }, body: { results: [{ analyte: 'Hb', value: 1 }] } }), b);
    expect(b.status).toHaveBeenCalledWith(409);
    expect(prismaMock.labResult.createMany).not.toHaveBeenCalled();
  });

  it('no notification when nothing is critical', async () => {
    (notify as jest.Mock).mockClear();
    prismaMock.labOrder.findFirst.mockResolvedValue(order as any);
    withTx(1);
    prismaMock.labResult.createMany.mockResolvedValue({ count: 1 });
    await submitResults(as('DOCTOR', { params: { id: 'l1' }, body: { results: [{ analyte: 'Hb', value: 14, refLow: 12, refHigh: 17 }] } }), mockResponse());
    expect(notify).not.toHaveBeenCalled();
  });

  it('cancel only while ORDERED (WHERE status); 409 otherwise', async () => {
    prismaMock.labOrder.findFirst.mockResolvedValue({ id: 'l1' } as any);
    prismaMock.labOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    const a = mockResponse();
    await cancelLabOrder(as('DOCTOR', { params: { id: 'l1' } }), a);
    expect(prismaMock.labOrder.updateMany.mock.calls[0][0].where).toEqual({ id: 'l1', hospitalId: 'hosp-1', status: 'ORDERED' });
    expect(a.status).toHaveBeenCalledWith(409);
    prismaMock.labOrder.updateMany.mockResolvedValueOnce({ count: 1 });
    const b = mockResponse();
    await cancelLabOrder(as('DOCTOR', { params: { id: 'l1' } }), b);
    expect(b.status).toHaveBeenCalledWith(200);
  });
});
