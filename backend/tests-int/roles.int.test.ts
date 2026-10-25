// PHARMACIST and BILLING against a real database: the enum values exist after the migration, each role can do its whole job
// without clinical access, and neither sees another hospital's data.
import { prisma, resetDb, closeDb } from './helpers/db';
import { call } from './helpers/app';
import { bearer, makeWorld, makeUser, makeMedication, makePrescription } from './helpers/factories';

afterAll(closeDb);

type World = Awaited<ReturnType<typeof makeWorld>>;
let A: World;
let B: World;
let pharmacist: { id: string };
let biller: { id: string };
let itemId: string;

beforeAll(async () => {
  await resetDb();
  A = await makeWorld();
  B = await makeWorld();
  pharmacist = await makeUser(A.hospital.id, 'PHARMACIST');
  biller = await makeUser(A.hospital.id, 'BILLING');
  const med = await makeMedication(A.hospital.id, { name: 'Amoxicillin', stockQuantity: 0, unitPriceMinor: 500 });
  itemId = (await makePrescription(A.hospital.id, A.patient.id, med.id)).item.id;
  const theirMed = await makeMedication(B.hospital.id, { name: 'Theirs', stockQuantity: 5 });
  await makePrescription(B.hospital.id, B.patient.id, theirMed.id);
  await prisma.invoice.create({ data: { hospitalId: B.hospital.id, patientId: B.patient.id, totalMinor: 1000 } });
});

describe('pharmacist', () => {
  it('receives stock, sees the queue (name + code only) and dispenses', async () => {
    const meds = await call('get', '/api/medications', bearer(pharmacist.id));
    const medId = (meds.body.data as { id: string }[])[0].id;
    expect((await call('post', '/api/pharmacy/receive', bearer(pharmacist.id), { medicationId: medId, quantity: 10 })).status).toBe(201);

    const queue = await call('get', '/api/pharmacy/queue', bearer(pharmacist.id));
    expect(queue.status).toBe(200);
    expect(queue.body.data).toHaveLength(1); // hospital B's prescription is not listed
    expect(queue.body.data[0].patient).toEqual({ id: A.patient.id, name: A.patient.name, patientCode: A.patient.patientCode });
    expect(JSON.stringify(queue.body)).not.toMatch(/diagnosis|Theirs/);

    expect((await call('post', '/api/pharmacy/dispense', bearer(pharmacist.id), { prescriptionItemId: itemId, quantity: 4 })).status).toBe(201);
    expect((await prisma.medication.findUniqueOrThrow({ where: { id: medId } })).stockQuantity).toBe(6);
    expect((await call('post', '/api/pharmacy/dispense', bearer(pharmacist.id), { prescriptionItemId: itemId, quantity: 7 })).status).toBe(409);
  });

  it('has no clinical, billing or lookup access', async () => {
    for (const url of [`/api/clinical-notes?patientId=${A.patient.id}`, `/api/prescriptions?patientId=${A.patient.id}`, `/api/lab-orders?patientId=${A.patient.id}`, '/api/billing/invoices', '/api/billing/patients', '/api/patients', '/api/audit-logs']) {
      expect((await call('get', url, bearer(pharmacist.id))).status).toBe(403);
    }
  });
});

describe('billing', () => {
  it('bills the dispensation, issues the invoice and takes the payment', async () => {
    const found = await call('get', '/api/billing/patients?q=PT', bearer(biller.id));
    expect(found.status).toBe(200);
    expect(found.body.data.every((p: { id: string }) => p.id !== B.patient.id)).toBe(true); // other hospital never listed
    expect(Object.keys(found.body.data[0]).sort()).toEqual(['id', 'name', 'patientCode']);

    const created = await call('post', '/api/billing/invoices', bearer(biller.id), { patientId: A.patient.id, includeDispensations: true });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    expect(created.body.data.totalMinor).toBe(4 * 500);
    expect((await call('post', `/api/billing/invoices/${id}/issue`, bearer(biller.id))).status).toBe(200);
    expect((await call('post', `/api/billing/invoices/${id}/payments`, bearer(biller.id), { amountMinor: 2000, method: 'CASH' })).status).toBe(201);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id } })).status).toBe('PAID');

    const xlsx = await call('get', '/api/exports/billing?format=xlsx', bearer(biller.id));
    expect(xlsx.status).toBe(200);
  });

  it('has no clinical, pharmacy or other-export access, and cannot touch hospital B invoices', async () => {
    for (const url of ['/api/pharmacy/stock', '/api/pharmacy/queue', '/api/medications', `/api/prescriptions?patientId=${A.patient.id}`, '/api/exports/patients?format=xlsx', '/api/patients']) {
      expect((await call('get', url, bearer(biller.id))).status).toBe(403);
    }
    const theirs = await prisma.invoice.findFirstOrThrow({ where: { hospitalId: B.hospital.id } });
    expect((await call('get', `/api/billing/invoices/${theirs.id}`, bearer(biller.id))).status).toBe(404);
    expect((await call('post', `/api/billing/invoices/${theirs.id}/void`, bearer(biller.id))).status).toBe(404);
  });
});

describe('role assignment', () => {
  it('an admin can make a user a pharmacist or a biller', async () => {
    const u = await makeUser(A.hospital.id, 'NURSE');
    const res = await call('put', `/api/users/${u.id}/role`, bearer(A.admin.id), { role: 'PHARMACIST' });
    expect(res.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe('PHARMACIST');
    expect((await call('put', `/api/users/${u.id}/role`, bearer(A.admin.id), { role: 'BILLING' })).status).toBe(200);
  });
});
