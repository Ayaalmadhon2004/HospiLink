// Guards that live IN the database (triggers, CHECKs, exclusion and unique constraints). Mocked Prisma cannot test these.
import { prisma, resetDb, closeDb, pgCode, pgMessage, rejection } from './helpers/db';
import { makeHospital, makeUser, makePatient, makeStaff, makeWard, makeBed, makeMedication } from './helpers/factories';

beforeEach(resetDb);
afterAll(closeDb);

describe('patients are never hard-deleted (trigger)', () => {
  it('DELETE is rejected with restrict_violation; the soft delete (deletedAt) works', async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    const err = await rejection(() => prisma.patient.delete({ where: { id: p.id } }));
    expect(pgCode(err)).toBe('23001');
    expect(pgMessage(err)).toMatch(/soft-deleted/i);
    expect(await prisma.patient.count({ where: { id: p.id } })).toBe(1);
    await prisma.patient.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    expect((await prisma.patient.findUnique({ where: { id: p.id } }))?.deletedAt).toBeInstanceOf(Date);
  });
});

describe('clinical notes are immutable (trigger)', () => {
  const note = async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    const n = await prisma.clinicalNote.create({ data: { hospitalId: h.id, patientId: p.id, type: 'PROGRESS', content: 'v1', authorName: 'Dr X' } });
    return { h, p, n };
  };

  it('UPDATE and DELETE are rejected; the content stays as written', async () => {
    const { n } = await note();
    expect(pgMessage(await rejection(() => prisma.clinicalNote.update({ where: { id: n.id }, data: { content: 'tampered' } })))).toMatch(/immutable/i);
    expect(pgMessage(await rejection(() => prisma.clinicalNote.delete({ where: { id: n.id } })))).toMatch(/immutable/i);
    expect((await prisma.clinicalNote.findUnique({ where: { id: n.id } }))?.content).toBe('v1');
  });

  it('an amendment is a new row; a second amendment of the SAME note is refused (unique), so history is a chain', async () => {
    const { h, p, n } = await note();
    const a1 = await prisma.clinicalNote.create({ data: { hospitalId: h.id, patientId: p.id, type: 'PROGRESS', content: 'v2', authorName: 'Dr X', supersedesId: n.id } });
    expect(a1.supersedesId).toBe(n.id);
    const err = await rejection(() => prisma.clinicalNote.create({ data: { hospitalId: h.id, patientId: p.id, type: 'PROGRESS', content: 'fork', authorName: 'Dr Y', supersedesId: n.id } }));
    expect(pgCode(err)).toMatch(/P2002|23505/);
    expect(await prisma.clinicalNote.count()).toBe(2);
  });

  it('deleting the author account keeps the note (ON DELETE SET NULL is the one change the trigger allows) with the name snapshot', async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    const u = await makeUser(h.id, 'DOCTOR');
    const n = await prisma.clinicalNote.create({ data: { hospitalId: h.id, patientId: p.id, type: 'PROGRESS', content: 'x', authorId: u.id, authorName: 'Dr Gone' } });
    await prisma.user.delete({ where: { id: u.id } });
    const after = await prisma.clinicalNote.findUnique({ where: { id: n.id } });
    expect(after).toMatchObject({ authorId: null, authorName: 'Dr Gone', content: 'x' });
  });

  it('but nulling the author by hand together with a content change is still refused', async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    const u = await makeUser(h.id, 'DOCTOR');
    const n = await prisma.clinicalNote.create({ data: { hospitalId: h.id, patientId: p.id, type: 'PROGRESS', content: 'x', authorId: u.id, authorName: 'Dr A' } });
    expect(pgMessage(await rejection(() => prisma.clinicalNote.update({ where: { id: n.id }, data: { authorId: null, content: 'rewritten' } })))).toMatch(/immutable/i);
    expect(pgMessage(await rejection(() => prisma.clinicalNote.update({ where: { id: n.id }, data: { authorName: 'Someone Else' } })))).toMatch(/immutable/i);
  });
});

describe('a doctor cannot have overlapping appointments (exclusion constraint)', () => {
  const appt = (doctorId: string, patientId: string, at: string, over: { duration?: number; status?: 'SCHEDULED' | 'CANCELLED' } = {}) =>
    prisma.appointment.create({ data: { doctorId, patientId, scheduledAt: new Date(at), duration: over.duration ?? 30, type: 'CONSULTATION', status: over.status ?? 'SCHEDULED', department: 'ICU' } });

  it('overlap -> 23P01; back-to-back, other doctor and cancelled slots are fine', async () => {
    const h = await makeHospital();
    const [d1, d2, p] = [await makeStaff(h.id), await makeStaff(h.id), await makePatient(h.id)];
    await appt(d1.id, p.id, '2026-03-01T09:00:00Z');
    expect(pgCode(await rejection(() => appt(d1.id, p.id, '2026-03-01T09:15:00Z')))).toBe('23P01');
    await appt(d1.id, p.id, '2026-03-01T09:30:00Z'); // starts exactly when the first ends
    await appt(d2.id, p.id, '2026-03-01T09:15:00Z'); // another doctor
    await appt(d1.id, p.id, '2026-03-01T09:10:00Z', { status: 'CANCELLED' }); // cancelled does not block
    expect(await prisma.appointment.count()).toBe(4);
  });

  it('two requests racing for the same slot: exactly one wins', async () => {
    const h = await makeHospital();
    const [d, p] = [await makeStaff(h.id), await makePatient(h.id)];
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => appt(d.id, p.id, '2026-04-01T10:00:00Z')));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.appointment.count()).toBe(1);
  });
});

describe('money and stock CHECK constraints', () => {
  it('stock can never be negative; reorder level and price cannot be negative', async () => {
    const h = await makeHospital();
    const m = await makeMedication(h.id, { stockQuantity: 3 });
    expect(pgCode(await rejection(() => prisma.medication.update({ where: { id: m.id }, data: { stockQuantity: { decrement: 4 } } })))).toBe('23514');
    expect(pgCode(await rejection(() => prisma.medication.update({ where: { id: m.id }, data: { unitPriceMinor: -1 } })))).toBe('23514');
    expect((await prisma.medication.findUnique({ where: { id: m.id } }))?.stockQuantity).toBe(3);
  });

  it('an invoice can never be paid beyond its total; payments must be positive', async () => {
    const h = await makeHospital();
    const p = await makePatient(h.id);
    const inv = await prisma.invoice.create({ data: { hospitalId: h.id, patientId: p.id, totalMinor: 1000 } });
    expect(pgCode(await rejection(() => prisma.invoice.update({ where: { id: inv.id }, data: { paidMinor: 1001 } })))).toBe('23514');
    expect(pgCode(await rejection(() => prisma.payment.create({ data: { invoiceId: inv.id, hospitalId: h.id, amountMinor: 0, method: 'CASH', receivedByName: 'x' } })))).toBe('23514');
    expect(pgCode(await rejection(() => prisma.invoiceLine.create({ data: { invoiceId: inv.id, description: 'x', quantity: 0, unitPriceMinor: 1, totalMinor: 0 } })))).toBe('23514');
  });

  it('invoice numbers are unique per hospital but can repeat across hospitals; drafts (no number) never collide', async () => {
    const [h1, h2] = [await makeHospital(), await makeHospital()];
    const [p1, p2] = [await makePatient(h1.id), await makePatient(h2.id)];
    await prisma.invoice.create({ data: { hospitalId: h1.id, patientId: p1.id, number: 'INV-000001' } });
    await prisma.invoice.create({ data: { hospitalId: h2.id, patientId: p2.id, number: 'INV-000001' } });
    expect(pgCode(await rejection(() => prisma.invoice.create({ data: { hospitalId: h1.id, patientId: p1.id, number: 'INV-000001' } })))).toMatch(/P2002|23505/);
    await prisma.invoice.createMany({ data: [{ hospitalId: h1.id, patientId: p1.id }, { hospitalId: h1.id, patientId: p1.id }] });
  });
});

describe('beds', () => {
  it('a bed holds at most one patient (unique Patient.bedId) and a ward cannot be deleted while it has beds (Restrict)', async () => {
    const h = await makeHospital();
    const w = await makeWard(h.id);
    const b = await makeBed(h.id, w.id);
    await makePatient(h.id, { bedId: b.id });
    expect(pgCode(await rejection(() => makePatient(h.id, { bedId: b.id })))).toMatch(/P2002|23505/);
    expect(pgCode(await rejection(() => prisma.ward.delete({ where: { id: w.id } })))).toMatch(/P2003|23001|23503/);
  });
});
