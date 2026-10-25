// Hospital isolation against a real database. Two hospitals with the same kinds of records; every route that takes an id is
// called by hospital A's staff with hospital B's id and must answer "not found" (never 200, never a leak, never a write).
import ExcelJS from 'exceljs';
import { prisma, resetDb, closeDb } from './helpers/db';
import { call, buildApp } from './helpers/app';
import request from 'supertest';
import { bearer, makeWorld, makeStaff, makeMedication, makePrescription, makeBed, makeWard, makePatient } from './helpers/factories';

afterAll(closeDb);

type World = Awaited<ReturnType<typeof makeWorld>>;
let A: World;
let B: World;
let theirs: {
  note: { id: string }; medication: { id: string }; rx: { id: string }; rxItem: { id: string }; lab: { id: string };
  invoice: { id: string }; deviceKey: { id: string }; staff: { id: string }; vitals: { id: string }; notification: { id: string }; bed2: { id: string };
};

beforeAll(async () => {
  await resetDb();
  A = await makeWorld();
  B = await makeWorld();
  const note = await prisma.clinicalNote.create({ data: { hospitalId: B.hospital.id, patientId: B.patient.id, type: 'PROGRESS', content: 'secret', authorName: 'Dr B' } });
  const medication = await makeMedication(B.hospital.id, { stockQuantity: 50 });
  const { prescription: rx, item: rxItem } = await makePrescription(B.hospital.id, B.patient.id, medication.id);
  const lab = await prisma.labOrder.create({ data: { hospitalId: B.hospital.id, patientId: B.patient.id, testName: 'CBC', orderedByName: 'Dr B' } });
  const invoice = await prisma.invoice.create({ data: { hospitalId: B.hospital.id, patientId: B.patient.id, totalMinor: 1000 } });
  const deviceKey = await prisma.deviceKey.create({ data: { hospitalId: B.hospital.id, name: 'B monitor', keyHash: 'b-hash' } });
  const staff = await makeStaff(B.hospital.id);
  const vitals = await prisma.patientVitals.create({ data: { patientId: B.patient.id, heartRate: 80, recordedBy: 'x' } });
  const notification = await prisma.notification.create({ data: { userId: B.doctor.id, type: 'SYSTEM', title: 'B only', message: 'private' } });
  const bed2 = await makeBed(B.hospital.id, B.ward.id);
  theirs = { note, medication, rx, rxItem, lab, invoice, deviceKey, staff, vitals, notification, bed2 };
});

describe("hospital A cannot touch hospital B's records", () => {
  // [description, method, url(B ids), caller of A, body, expected status]
  type Call = ['get' | 'post' | 'put' | 'delete', string, string, object | undefined, number];
  // Lambdas: the ids exist only after beforeAll has created both hospitals.
  const specs: [string, () => Call][] = [
    ['read a patient', () => ['get', `/api/patients/${B.patient.id}`, A.admin.id, undefined, 404]],
    ['update a patient', () => ['put', `/api/patients/${B.patient.id}`, A.admin.id, { name: 'Hacked' }, 404]],
    ['discharge a patient', () => ['put', `/api/patients/${B.patient.id}/discharge`, A.admin.id, {}, 404]],
    ['delete a patient', () => ['delete', `/api/patients/${B.patient.id}`, A.admin.id, undefined, 404]],
    ['admit into their bed', () => ['post', '/api/patients/admit', A.admin.id, { name: 'X', age: 30, gender: 'MALE', department: 'ICU', diagnosis: 'x', bedId: B.bed.id }, 404]],
    ['admit under their doctor', () => ['post', '/api/patients/admit', A.admin.id, { name: 'X', age: 30, gender: 'MALE', department: 'ICU', diagnosis: 'x', doctorId: theirs.staff.id }, 404]],
    ['read a bed', () => ['get', `/api/beds/${B.bed.id}`, A.admin.id, undefined, 404]],
    ['update a bed', () => ['put', `/api/beds/${B.bed.id}`, A.admin.id, { status: 'MAINTENANCE' }, 404]],
    ['delete a bed', () => ['delete', `/api/beds/${theirs.bed2.id}`, A.admin.id, undefined, 404]],
    ['move my bed into their ward', () => ['put', `/api/beds/${A.bed.id}`, A.admin.id, { wardId: B.ward.id }, 404]],
    ['rename their ward', () => ['put', `/api/wards/${B.ward.id}`, A.admin.id, { name: 'Hacked' }, 404]],
    ['delete their ward', () => ['delete', `/api/wards/${B.ward.id}`, A.admin.id, undefined, 404]],
    ['read their staff member', () => ['get', `/api/staff/${theirs.staff.id}`, A.admin.id, undefined, 404]],
    ['link their login to their staff', () => ['put', `/api/staff/${theirs.staff.id}/login`, A.admin.id, { userId: null }, 404]],
    ['change their user\'s role', () => ['put', `/api/users/${B.doctor.id}/role`, A.admin.id, { role: 'ADMIN' }, 404]],
    ['deactivate their user', () => ['put', `/api/users/${B.nurse.id}/deactivate`, A.admin.id, undefined, 404]],
    ['activate their user', () => ['put', `/api/users/${B.nurse.id}/activate`, A.admin.id, { role: 'ADMIN' }, 404]],
    ['reset their user 2FA', () => ['post', `/api/users/${B.nurse.id}/2fa/reset`, A.admin.id, undefined, 404]],
    ['read their vitals record', () => ['get', `/api/vitals/${theirs.vitals.id}`, A.doctor.id, undefined, 404]],
    ['edit their vitals record', () => ['put', `/api/vitals/${theirs.vitals.id}`, A.doctor.id, { heartRate: 1 }, 404]],
    ['record vitals for their patient', () => ['post', '/api/vitals', A.doctor.id, { patientId: B.patient.id, heartRate: 70 }, 404]],
    ['write a note on their patient', () => ['post', '/api/clinical-notes', A.doctor.id, { patientId: B.patient.id, type: 'PROGRESS', content: 'x' }, 404]],
    ['amend their note', () => ['post', `/api/clinical-notes/${theirs.note.id}/amend`, A.doctor.id, { content: 'x' }, 404]],
    ['read their note history', () => ['get', `/api/clinical-notes/${theirs.note.id}/history`, A.doctor.id, undefined, 404]],
    ['edit their medication', () => ['put', `/api/medications/${theirs.medication.id}`, A.doctor.id, { active: false }, 404]],
    ['prescribe to their patient', () => ['post', '/api/prescriptions', A.doctor.id, { patientId: B.patient.id, items: [{ medicationId: theirs.medication.id, dose: '1', frequency: 'QD' }] }, 404]],
    ['prescribe their medication to my patient', () => ['post', '/api/prescriptions', A.doctor.id, { patientId: A.patient.id, items: [{ medicationId: theirs.medication.id, dose: '1', frequency: 'QD' }] }, 400]],
    ['close their prescription', () => ['put', `/api/prescriptions/${theirs.rx.id}/status`, A.doctor.id, { status: 'CANCELLED' }, 404]],
    ['order a lab for their patient', () => ['post', '/api/lab-orders', A.doctor.id, { patientId: B.patient.id, testName: 'CBC' }, 404]],
    ['enter results on their lab order', () => ['post', `/api/lab-orders/${theirs.lab.id}/results`, A.doctor.id, { results: [{ analyte: 'Hb', value: 1 }] }, 404]],
    ['cancel their lab order', () => ['put', `/api/lab-orders/${theirs.lab.id}/cancel`, A.doctor.id, undefined, 404]],
    ['dispense their prescription item', () => ['post', '/api/pharmacy/dispense', A.nurse.id, { prescriptionItemId: theirs.rxItem.id, quantity: 1 }, 404]],
    ['receive stock for their medication', () => ['post', '/api/pharmacy/receive', A.admin.id, { medicationId: theirs.medication.id, quantity: 5 }, 404]],
    ['adjust their stock', () => ['post', '/api/pharmacy/adjust', A.admin.id, { medicationId: theirs.medication.id, delta: -5, note: 'steal' }, 404]],
    ['read their invoice', () => ['get', `/api/billing/invoices/${theirs.invoice.id}`, A.admin.id, undefined, 404]],
    ['invoice their patient', () => ['post', '/api/billing/invoices', A.admin.id, { patientId: B.patient.id }, 404]],
    ['add a line to their invoice', () => ['post', `/api/billing/invoices/${theirs.invoice.id}/lines`, A.admin.id, { description: 'x', quantity: 1, unitPriceMinor: 1 }, 404]],
    ['discount their invoice', () => ['put', `/api/billing/invoices/${theirs.invoice.id}/discount`, A.admin.id, { discountMinor: 1 }, 404]],
    ['issue their invoice', () => ['post', `/api/billing/invoices/${theirs.invoice.id}/issue`, A.admin.id, undefined, 404]],
    ['pay their invoice', () => ['post', `/api/billing/invoices/${theirs.invoice.id}/payments`, A.admin.id, { amountMinor: 1, method: 'CASH' }, 404]],
    ['void their invoice', () => ['post', `/api/billing/invoices/${theirs.invoice.id}/void`, A.admin.id, undefined, 404]],
    ['revoke their device key', () => ['delete', `/api/devices/${theirs.deviceKey.id}`, A.admin.id, undefined, 404]],
    // Notifications are per user: the delete is scoped to the caller, so it is an idempotent no-op (checked in the "unchanged" test below).
    ['delete their notification (no-op)', () => ['delete', `/api/notifications/${theirs.notification.id}`, A.doctor.id, undefined, 200]],
  ];

  it.each(specs.map(([label], i) => [label, i] as const))('%s -> refused', async (_label, i) => {
    const [method, url, actor, body, expected] = specs[i][1]();
    const res = await call(method, url, bearer(actor), body);
    expect(res.status).toBe(expected);
  });

  it('after all of that, hospital B\'s data is exactly as it was', async () => {
    for (const [, build] of specs) {
      const [method, url, actor, body] = build();
      await call(method, url, bearer(actor), body);
    }
    expect(await prisma.patient.findUnique({ where: { id: B.patient.id } })).toMatchObject({ name: B.patient.name, status: 'OBSERVATION', deletedAt: null });
    expect((await prisma.bed.findUnique({ where: { id: B.bed.id } }))?.status).toBe('AVAILABLE');
    expect((await prisma.ward.findUnique({ where: { id: B.ward.id } }))?.name).toBe(B.ward.name);
    expect(await prisma.user.findUnique({ where: { id: B.doctor.id } })).toMatchObject({ role: 'DOCTOR', accountStatus: 'ACTIVE' });
    expect(await prisma.user.findUnique({ where: { id: B.nurse.id } })).toMatchObject({ role: 'NURSE', accountStatus: 'ACTIVE', passwordChangedAt: null });
    expect((await prisma.medication.findUnique({ where: { id: theirs.medication.id } }))?.stockQuantity).toBe(50);
    expect(await prisma.stockMovement.count()).toBe(0);
    expect(await prisma.clinicalNote.count({ where: { hospitalId: B.hospital.id } })).toBe(1);
    expect((await prisma.prescription.findUnique({ where: { id: theirs.rx.id } }))?.status).toBe('ACTIVE');
    expect((await prisma.labOrder.findUnique({ where: { id: theirs.lab.id } }))?.status).toBe('ORDERED');
    expect(await prisma.invoice.findUnique({ where: { id: theirs.invoice.id } })).toMatchObject({ status: 'DRAFT', paidMinor: 0, discountMinor: 0, totalMinor: 1000 });
    expect((await prisma.deviceKey.findUnique({ where: { id: theirs.deviceKey.id } }))?.revokedAt).toBeNull();
    expect(await prisma.notification.count({ where: { id: theirs.notification.id } })).toBe(1);
    expect(await prisma.patient.count({ where: { hospitalId: A.hospital.id } })).toBe(1); // nothing was admitted
  });
});

describe('list endpoints only ever return the caller\'s hospital', () => {
  const ids = (res: request.Response): string[] => (res.body.data as { id: string }[]).map((r) => r.id);

  it('patients, beds, wards, staff, users, medications, invoices, notes, device keys', async () => {
    await makeStaff(A.hospital.id);
    await prisma.deviceKey.create({ data: { hospitalId: A.hospital.id, name: 'A monitor', keyHash: 'a-hash' } });
    await prisma.invoice.create({ data: { hospitalId: A.hospital.id, patientId: A.patient.id } });

    const own = bearer(A.admin.id);
    expect(ids(await call('get', '/api/patients', own))).toEqual([A.patient.id]);
    expect(ids(await call('get', '/api/beds', own))).toEqual([A.bed.id]);
    expect(ids(await call('get', '/api/wards', own))).toEqual([A.ward.id]);
    expect(ids(await call('get', '/api/users', own)).sort()).toEqual([A.admin.id, A.doctor.id, A.nurse.id].sort());
    expect(ids(await call('get', '/api/medications', own))).toEqual([]);
    expect((await call('get', '/api/billing/invoices', own)).body.data).toHaveLength(1);
    expect((await call('get', '/api/devices', own)).body.data).toHaveLength(1);
    const staffIds = ids(await call('get', '/api/staff', own));
    expect(staffIds).not.toContain(theirs.staff.id);
    // asking for the other hospital's patient explicitly yields nothing, not their data
    expect((await call('get', `/api/clinical-notes?patientId=${B.patient.id}`, bearer(A.doctor.id))).body.data).toEqual([]);
    expect((await call('get', `/api/prescriptions?patientId=${B.patient.id}`, bearer(A.doctor.id))).body.data).toEqual([]);
    expect((await call('get', `/api/lab-orders?patientId=${B.patient.id}`, bearer(A.doctor.id))).body.data).toEqual([]);
    expect((await call('get', `/api/vitals?patientId=${B.patient.id}`, bearer(A.doctor.id))).body.data).toEqual([]);
  });

  it('the audit trail shows only the hospital\'s own entries, even when asking for the other hospital\'s user', async () => {
    await prisma.auditLog.createMany({ data: [
      { action: 'A_ACTION', userId: A.admin.id, hospitalId: A.hospital.id, entityId: 'x' },
      { action: 'B_ACTION', userId: B.admin.id, hospitalId: B.hospital.id, entityId: 'y' },
      { action: 'LEGACY', userId: null, hospitalId: null, entityId: 'z' },
    ] });
    // The API calls of the other tests also write real audit rows; every one must belong to hospital A's people.
    const mine = await call('get', '/api/audit-logs?limit=200', bearer(A.admin.id));
    const rows = mine.body.data as { action: string; user: { id: string } | null }[];
    const aUsers = new Set([A.admin.id, A.doctor.id, A.nurse.id]);
    expect(rows.map((r) => r.action)).toContain('A_ACTION');
    expect(rows.map((r) => r.action)).not.toContain('B_ACTION');
    expect(rows.map((r) => r.action)).not.toContain('LEGACY'); // rows whose actor was already gone are never shown
    expect(rows.every((r) => r.user === null || aUsers.has(r.user.id))).toBe(true);
    const spoof = await call('get', `/api/audit-logs?userId=${B.admin.id}`, bearer(A.admin.id));
    expect(spoof.body.data).toEqual([]);
    const actions = (await call('get', '/api/audit-logs/actions', bearer(A.admin.id))).body.data as string[];
    expect(actions).toContain('A_ACTION');
    expect(actions).not.toContain('B_ACTION');
  });

  it('a user created by an admin lands in the admin\'s own hospital whatever the body says', async () => {
    const res = await call('post', '/api/users', bearer(A.admin.id), { email: 'new@int.test', password: 'Passw0rd!123', name: 'New Nurse', role: 'NURSE', department: 'ER', shift: 'DAY', hospitalId: B.hospital.id });
    expect(res.status).toBe(201);
    expect((await prisma.user.findUnique({ where: { email: 'new@int.test' } }))?.hospitalId).toBe(A.hospital.id);
  });
});

describe('exports contain only the caller\'s hospital and no soft-deleted patients', () => {
  const download = async (type: string, userId: string) => {
    const res = await request(buildApp()).get(`/api/exports/${type}?format=xlsx`).set('Authorization', bearer(userId)).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(res.body as ArrayBuffer);
    const ws = wb.worksheets[0];
    const rows: string[][] = [];
    ws.eachRow((row, i) => { if (i > 1) rows.push((row.values as unknown[]).slice(1).map((v) => String(v ?? ''))); });
    return rows;
  };

  it('patients', async () => {
    const gone = await makePatient(A.hospital.id, { name: 'Deleted Dana' });
    await prisma.patient.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    const names = (await download('patients', A.admin.id)).map((r) => r[1]);
    expect(names).toContain(A.patient.name);
    expect(names).not.toContain(B.patient.name);
    expect(names).not.toContain('Deleted Dana');
  });

  it('billing (balance column) and vitals', async () => {
    await prisma.invoice.updateMany({ where: { hospitalId: A.hospital.id }, data: { status: 'ISSUED', number: 'INV-000001', totalMinor: 1000, paidMinor: 250 } });
    const billing = await download('billing', A.admin.id);
    expect(billing).toHaveLength(1);
    expect(billing[0][7]).toBe('10'); // Total in major units
    expect(billing[0][10]).toBe('7.5'); // Balance = 10.00 - 2.50
    await prisma.patientVitals.create({ data: { patientId: A.patient.id, heartRate: 77, recordedBy: 'x' } });
    const vitals = await download('vitals', A.doctor.id);
    expect(vitals).toHaveLength(1);
    expect(vitals[0][1]).toBe(A.patient.name);
  });
});

void makeWard;
