// Races that only a real database can arbitrate: every "exactly one wins" below is decided by a row lock, a unique
// index or a conditional UPDATE, not by application code. Requests are fired in parallel through the real routers.
import { prisma, resetDb, closeDb } from './helpers/db';
import { call } from './helpers/app';
import { bearer, makeHospital, makeUser, makeWard, makeBed, makePatient, makeMedication, makePrescription, makeStaff, makeWorld } from './helpers/factories';
import { runReminders } from '../src/services/reminders.service';

beforeEach(resetDb);
afterAll(closeDb);

const statuses = (rs: { status: number }[]) => rs.map((r) => r.status).sort();
const count = (rs: { status: number }[], status: number) => rs.filter((r) => r.status === status).length;

describe('admitting patients', () => {
  it('8 admits for the SAME bed: exactly one gets it, the others are refused and leave no patient behind', async () => {
    const { admin, bed, hospital } = await makeWorld();
    const before = await prisma.patient.count({ where: { hospitalId: hospital.id } });
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) =>
      call('post', '/api/patients/admit', bearer(admin.id), { name: `Racer ${i}`, age: 30, gender: 'MALE', department: 'ICU', diagnosis: 'x', bedId: bed.id })));
    expect(count(results, 201)).toBe(1);
    expect(results.filter((r) => r.status !== 201).every((r) => r.status === 409)).toBe(true);
    expect(await prisma.patient.count({ where: { hospitalId: hospital.id } })).toBe(before + 1);
    expect(await prisma.patient.count({ where: { bedId: bed.id } })).toBe(1);
    expect((await prisma.bed.findUnique({ where: { id: bed.id } }))?.status).toBe('OCCUPIED');
  });

  it('12 concurrent admits without a bed all succeed with distinct, sequential-looking codes (code race is retried)', async () => {
    const { admin } = await makeWorld();
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) =>
      call('post', '/api/patients/admit', bearer(admin.id), { name: `P ${i}`, age: 20, gender: 'FEMALE', department: 'ER', diagnosis: 'x' })));
    expect(statuses(results)).toEqual(Array(12).fill(201));
    const codes = results.map((r) => r.body.data.patientCode as string);
    expect(new Set(codes).size).toBe(12);
  });
});

describe('pharmacy stock', () => {
  it('15 nurses dispense the last 10 units at once: exactly 10 succeed, stock ends at 0 (never negative) and the ledger adds up', async () => {
    const { hospital, nurse, patient } = await makeWorld();
    const med = await makeMedication(hospital.id, { stockQuantity: 10 });
    const { item } = await makePrescription(hospital.id, patient.id, med.id);
    const results = await Promise.all(Array.from({ length: 15 }, () =>
      call('post', '/api/pharmacy/dispense', bearer(nurse.id), { prescriptionItemId: item.id, quantity: 1 })));
    expect(count(results, 201)).toBe(10);
    expect(count(results, 409)).toBe(5);
    expect(results.filter((r) => r.status === 409).every((r) => r.body.error.code === 'INSUFFICIENT_STOCK')).toBe(true);
    expect((await prisma.medication.findUnique({ where: { id: med.id } }))?.stockQuantity).toBe(0);
    expect(await prisma.dispensation.count({ where: { prescriptionItemId: item.id } })).toBe(10);
    const movements = await prisma.stockMovement.findMany({ where: { medicationId: med.id } });
    expect(movements).toHaveLength(10);
    expect(movements.reduce((s, m) => s + m.delta, 0)).toBe(-10);
  });

  it('mixed receives, adjustments and dispenses keep stock == sum of the ledger', async () => {
    const { hospital, admin, nurse, patient } = await makeWorld();
    const med = await makeMedication(hospital.id, { stockQuantity: 0 });
    const { item } = await makePrescription(hospital.id, patient.id, med.id);
    await call('post', '/api/pharmacy/receive', bearer(admin.id), { medicationId: med.id, quantity: 20 });
    const ops = [
      ...Array.from({ length: 10 }, () => call('post', '/api/pharmacy/dispense', bearer(nurse.id), { prescriptionItemId: item.id, quantity: 2 })),
      ...Array.from({ length: 4 }, () => call('post', '/api/pharmacy/adjust', bearer(admin.id), { medicationId: med.id, delta: -3, note: 'count correction' })),
      ...Array.from({ length: 3 }, () => call('post', '/api/pharmacy/receive', bearer(admin.id), { medicationId: med.id, quantity: 5 })),
    ];
    await Promise.all(ops);
    const stock = (await prisma.medication.findUnique({ where: { id: med.id } }))!.stockQuantity;
    const ledger = (await prisma.stockMovement.aggregate({ where: { medicationId: med.id }, _sum: { delta: true } }))._sum.delta;
    expect(stock).toBeGreaterThanOrEqual(0);
    expect(ledger).toBe(stock);
  });
});

describe('billing', () => {
  const issuedInvoice = async (hospitalId: string, patientId: string, total: number) => {
    const inv = await prisma.invoice.create({ data: { hospitalId, patientId, status: 'ISSUED', number: 'INV-000001', totalMinor: total, issuedAt: new Date() } });
    await prisma.invoiceLine.create({ data: { invoiceId: inv.id, description: 'Stay', quantity: 1, unitPriceMinor: total, totalMinor: total } });
    return inv;
  };

  it('7 payments of 200 against a 1000 invoice: exactly 5 are accepted, it becomes PAID and is never overpaid', async () => {
    const { hospital, admin, patient } = await makeWorld();
    const inv = await issuedInvoice(hospital.id, patient.id, 1000);
    const results = await Promise.all(Array.from({ length: 7 }, () =>
      call('post', `/api/billing/invoices/${inv.id}/payments`, bearer(admin.id), { amountMinor: 200, method: 'CASH' })));
    expect(count(results, 201)).toBe(5);
    expect(count(results, 409)).toBe(2);
    const after = await prisma.invoice.findUnique({ where: { id: inv.id } });
    expect(after).toMatchObject({ paidMinor: 1000, status: 'PAID' });
    expect(await prisma.payment.count({ where: { invoiceId: inv.id } })).toBe(5);
  });

  it('8 drafts issued at once get INV-000001..8 exactly once each; a refused issue burns no number', async () => {
    const { hospital, admin, patient } = await makeWorld();
    const drafts = await Promise.all(Array.from({ length: 8 }, async () => {
      const d = await prisma.invoice.create({ data: { hospitalId: hospital.id, patientId: patient.id, totalMinor: 500 } });
      await prisma.invoiceLine.create({ data: { invoiceId: d.id, description: 'x', quantity: 1, unitPriceMinor: 500, totalMinor: 500 } });
      return d;
    }));
    const results = await Promise.all(drafts.map((d) => call('post', `/api/billing/invoices/${d.id}/issue`, bearer(admin.id))));
    expect(statuses(results)).toEqual(Array(8).fill(200));
    const numbers = (await prisma.invoice.findMany({ where: { hospitalId: hospital.id }, select: { number: true } })).map((i) => i.number).sort();
    expect(numbers).toEqual(Array.from({ length: 8 }, (_, i) => `INV-${String(i + 1).padStart(6, '0')}`));

    const empty = await prisma.invoice.create({ data: { hospitalId: hospital.id, patientId: patient.id } });
    expect((await call('post', `/api/billing/invoices/${empty.id}/issue`, bearer(admin.id))).status).toBe(409);
    expect((await prisma.hospital.findUnique({ where: { id: hospital.id } }))?.invoiceSeq).toBe(8);

    const next = await prisma.invoice.create({ data: { hospitalId: hospital.id, patientId: patient.id } });
    await prisma.invoiceLine.create({ data: { invoiceId: next.id, description: 'x', quantity: 1, unitPriceMinor: 1, totalMinor: 1 } });
    await call('post', `/api/billing/invoices/${next.id}/issue`, bearer(admin.id));
    expect((await prisma.invoice.findUnique({ where: { id: next.id } }))?.number).toBe('INV-000009');
  });

  it('two drafts built from the same dispensations at once: each dispensation is billed exactly once', async () => {
    const { hospital, admin, patient } = await makeWorld();
    const med = await makeMedication(hospital.id, { stockQuantity: 100, unitPriceMinor: 250 });
    const { item } = await makePrescription(hospital.id, patient.id, med.id);
    await prisma.dispensation.createMany({ data: [1, 2, 3].map((q) => ({ hospitalId: hospital.id, patientId: patient.id, prescriptionItemId: item.id, medicationId: med.id, quantity: q, unitPriceMinor: 250, dispensedByName: 'N' })) });
    const results = await Promise.all([1, 2].map(() => call('post', '/api/billing/invoices', bearer(admin.id), { patientId: patient.id, includeDispensations: true })));
    expect(count(results, 201)).toBeGreaterThanOrEqual(1);
    const billed = await prisma.dispensation.findMany({ where: { patientId: patient.id } });
    expect(billed.every((d) => d.invoiceLineId)).toBe(true);
    expect(new Set(billed.map((d) => d.invoiceLineId)).size).toBe(3);
    expect(await prisma.invoiceLine.count()).toBe(3); // a losing draft is rolled back with its lines
    const winner = results.find((r) => r.status === 201)!;
    expect(winner.body.data.totalMinor).toBe((1 + 2 + 3) * 250);
  });

  it('voiding an invoice releases its dispensations for a new draft', async () => {
    const { hospital, admin, patient } = await makeWorld();
    const med = await makeMedication(hospital.id, { unitPriceMinor: 100 });
    const { item } = await makePrescription(hospital.id, patient.id, med.id);
    await prisma.dispensation.create({ data: { hospitalId: hospital.id, patientId: patient.id, prescriptionItemId: item.id, medicationId: med.id, quantity: 2, unitPriceMinor: 100, dispensedByName: 'N' } });
    const first = await call('post', '/api/billing/invoices', bearer(admin.id), { patientId: patient.id, includeDispensations: true });
    expect(first.body.data.lines).toHaveLength(1);
    expect((await call('post', `/api/billing/invoices/${first.body.data.id}/void`, bearer(admin.id))).status).toBe(200);
    const second = await call('post', '/api/billing/invoices', bearer(admin.id), { patientId: patient.id, includeDispensations: true });
    expect(second.body.data.lines).toHaveLength(1);
    expect(second.body.data.totalMinor).toBe(200);
  });
});

describe('clinical records', () => {
  it('5 simultaneous amendments of one note: one wins, the rest get 409, the history stays a chain', async () => {
    const { hospital, doctor, patient } = await makeWorld();
    const note = await prisma.clinicalNote.create({ data: { hospitalId: hospital.id, patientId: patient.id, type: 'PROGRESS', content: 'v1', authorName: 'Dr' } });
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => call('post', `/api/clinical-notes/${note.id}/amend`, bearer(doctor.id), { content: `v2-${i}` })));
    expect(count(results, 201)).toBe(1);
    expect(count(results, 409)).toBe(4);
    expect(await prisma.clinicalNote.count()).toBe(2);
  });

  it('two doctors close the same prescription: one 200, one 409; two lab-result submissions: one 200, one 409 and one result set', async () => {
    const { hospital, doctor, patient } = await makeWorld();
    const med = await makeMedication(hospital.id);
    const { prescription } = await makePrescription(hospital.id, patient.id, med.id);
    const closed = await Promise.all(['COMPLETED', 'CANCELLED'].map((status) => call('put', `/api/prescriptions/${prescription.id}/status`, bearer(doctor.id), { status })));
    expect(statuses(closed)).toEqual([200, 409]);

    const order = await prisma.labOrder.create({ data: { hospitalId: hospital.id, patientId: patient.id, testName: 'CBC', orderedByName: 'Dr' } });
    const body = { results: [{ analyte: 'Hb', value: 14, refLow: 12, refHigh: 17 }] };
    const submitted = await Promise.all([1, 2].map(() => call('post', `/api/lab-orders/${order.id}/results`, bearer(doctor.id), body)));
    expect(statuses(submitted)).toEqual([200, 409]);
    expect(await prisma.labResult.count({ where: { labOrderId: order.id } })).toBe(1);
  });

  it('duplicate medications created at once: one 201, the rest 409', async () => {
    const { doctor } = await makeWorld();
    const results = await Promise.all(Array.from({ length: 6 }, () => call('post', '/api/medications', bearer(doctor.id), { name: 'Paracetamol', form: 'tablet', strength: '500 mg' })));
    expect(count(results, 201)).toBe(1);
    expect(count(results, 409)).toBe(5);
  });
});

describe('accounts', () => {
  it('two admins demoting each other at the same moment never leave the hospital without an admin (serializable)', async () => {
    for (let round = 0; round < 4; round++) {
      await resetDb();
      const h = await makeHospital();
      const [a1, a2] = [await makeUser(h.id, 'ADMIN'), await makeUser(h.id, 'ADMIN')];
      const results = await Promise.all([
        call('put', `/api/users/${a2.id}/role`, bearer(a1.id), { role: 'DOCTOR' }),
        call('put', `/api/users/${a1.id}/role`, bearer(a2.id), { role: 'DOCTOR' }),
      ]);
      const admins = await prisma.user.count({ where: { hospitalId: h.id, role: 'ADMIN', accountStatus: 'ACTIVE' } });
      expect(admins).toBeGreaterThanOrEqual(1);
      expect(count(results, 200)).toBe(1);
      expect(results.find((r) => r.status !== 200)?.status).toBe(409);
    }
  });

  it('reminders: 5 scheduler runs at the same moment notify the user once (claim via unique key)', async () => {
    const h = await makeHospital();
    const user = await makeUser(h.id, 'DOCTOR');
    await prisma.userSettings.create({ data: { userId: user.id, shiftReminders: true } }); // opt-in: the default is off
    const staff = await makeStaff(h.id, { userId: user.id });
    const now = new Date();
    await prisma.shift.create({ data: { staffId: staff.id, type: 'DAY', startTime: new Date(now.getTime() + 10 * 60_000), endTime: new Date(now.getTime() + 8 * 3_600_000), department: 'ICU' } });
    await Promise.all(Array.from({ length: 5 }, () => runReminders(now)));
    expect(await prisma.notification.count({ where: { userId: user.id, type: 'SHIFT' } })).toBe(1);
    expect(await prisma.reminderLog.count({ where: { userId: user.id } })).toBe(1);
    await runReminders(now); // a later run does not repeat it either
    expect(await prisma.notification.count({ where: { userId: user.id, type: 'SHIFT' } })).toBe(1);

    // And a user who did not opt in is not notified, nor is the claim kept (so enabling the setting later still delivers).
    const quiet = await makeUser(h.id, 'NURSE');
    const quietStaff = await makeStaff(h.id, { userId: quiet.id });
    await prisma.shift.create({ data: { staffId: quietStaff.id, type: 'DAY', startTime: new Date(now.getTime() + 12 * 60_000), endTime: new Date(now.getTime() + 8 * 3_600_000), department: 'ICU' } });
    await runReminders(now);
    expect(await prisma.notification.count({ where: { userId: quiet.id } })).toBe(0);
    expect(await prisma.reminderLog.count({ where: { userId: quiet.id } })).toBe(0);
  });
});

// keeps the unused-factory import honest if a test above is edited
void [makeWard, makeBed, makePatient];
