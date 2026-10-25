// Device vitals ingestion against a real database: key lifecycle, protocol adapters, tenant binding, alerting side effects.
import request from 'supertest';
import { prisma, resetDb, closeDb } from './helpers/db';
import { call, buildApp } from './helpers/app';
import { bearer, makeWorld, makePatient } from './helpers/factories';

afterAll(closeDb);

type World = Awaited<ReturnType<typeof makeWorld>>;
let A: World;
let B: World;
let key: string;
let keyId: string;

const ingest = (protocol: string, body: string | object, deviceKey: string | null = key, contentType = 'application/json') => {
  const req = request(buildApp()).post(`/api/vitals/ingest/${protocol}`).set('Content-Type', contentType);
  if (deviceKey) req.set('x-device-key', deviceKey);
  return req.send(body as never);
};
const hl7 = (code: string, obx: string[]) => ['MSH|^~\\&|MON|ICU|HOSPILINK|HL|20260101120000||ORU^R01|1|P|2.5', `PID|1||${code}`, ...obx].join('\r');

beforeEach(async () => {
  await resetDb();
  A = await makeWorld();
  B = await makeWorld();
  const created = await call('post', '/api/devices', bearer(A.admin.id), { name: 'ICU monitor 1' });
  expect(created.status).toBe(201);
  key = created.body.data.key;
  keyId = created.body.data.id;
});

describe('device keys', () => {
  it('only the hash is stored, the key works, lastUsedAt is recorded, and it lists without the secret', async () => {
    const row = await prisma.deviceKey.findUnique({ where: { id: keyId } });
    expect(row?.keyHash).not.toContain(key);
    expect(row?.keyHash).toHaveLength(64);
    expect(row?.hospitalId).toBe(A.hospital.id);
    expect((await ingest('json', { patientCode: A.patient.patientCode, heartRate: 70 })).status).toBe(201);
    await new Promise((r) => setTimeout(r, 200)); // lastUsedAt is written best-effort after the response
    expect((await prisma.deviceKey.findUnique({ where: { id: keyId } }))?.lastUsedAt).toBeInstanceOf(Date);
    const list = await call('get', '/api/devices', bearer(A.admin.id));
    expect(JSON.stringify(list.body)).not.toContain(key);
  });

  it('missing, unknown and revoked keys are refused and store nothing; revoking is immediate', async () => {
    const payload = { patientCode: A.patient.patientCode, heartRate: 70 };
    expect((await ingest('json', payload, null)).status).toBe(401);
    expect((await ingest('json', payload, 'hl_not_a_real_key')).status).toBe(401);
    expect((await call('delete', `/api/devices/${keyId}`, bearer(A.admin.id))).status).toBe(200);
    expect((await ingest('json', payload)).status).toBe(401);
    expect(await prisma.patientVitals.count()).toBe(0);
  });

  it('only an ADMIN manages keys', async () => {
    for (const u of [A.doctor, A.nurse]) {
      expect((await call('post', '/api/devices', bearer(u.id), { name: 'x' })).status).toBe(403);
      expect((await call('get', '/api/devices', bearer(u.id))).status).toBe(403);
    }
  });
});

describe('protocols end to end', () => {
  it('HL7 ORU^R01: stored with the device as recorder, BP split, °F converted', async () => {
    const res = await ingest('hl7', hl7(A.patient.patientCode, ['OBX|1|NM|8867-4^HR^LN||88|/min', 'OBX|2|ST|85354-9^BP^LN||120/80|mm[Hg]', 'OBX|3|NM|8310-5^T^LN||98.6|[degF]']), key, 'text/plain');
    expect(res.status).toBe(201);
    const v = await prisma.patientVitals.findFirstOrThrow({ where: { patientId: A.patient.id } });
    expect(v).toMatchObject({ heartRate: 88, systolicBP: 120, diastolicBP: 80, temperature: 37, recordedBy: `device:${keyId}`, isCritical: false });
  });

  it('FHIR Bundle with the BP panel components', async () => {
    const subject = { identifier: { value: A.patient.patientCode } };
    const res = await ingest('fhir', {
      resourceType: 'Bundle',
      entry: [
        { resource: { resourceType: 'Observation', subject, code: { coding: [{ code: '2708-6' }] }, valueQuantity: { value: 97 }, effectiveDateTime: '2026-01-01T10:00:00Z' } },
        { resource: { resourceType: 'Observation', subject, code: { coding: [{ code: '85354-9' }] }, component: [{ code: { coding: [{ code: '8480-6' }] }, valueQuantity: { value: 130 } }, { code: { coding: [{ code: '8462-4' }] }, valueQuantity: { value: 85 } }] } },
      ],
    }, key, 'application/fhir+json');
    expect(res.status).toBe(201);
    expect(await prisma.patientVitals.findFirstOrThrow({ where: { patientId: A.patient.id } })).toMatchObject({ spO2: 97, systolicBP: 130, diastolicBP: 85 });
  });

  it('JSON batch with one unknown patient -> 207; only the good reading is stored', async () => {
    const res = await ingest('json', { readings: [{ patientCode: A.patient.patientCode, heartRate: 75 }, { patientCode: 'PT-NOPE', heartRate: 75 }] });
    expect(res.status).toBe(207);
    expect(res.body.data.map((o: { status: string }) => o.status)).toEqual(['stored', 'rejected']);
    expect(await prisma.patientVitals.count()).toBe(1);
  });

  it('malformed bodies are 400 and store nothing', async () => {
    expect((await ingest('hl7', 'not hl7', key, 'text/plain')).status).toBe(400);
    expect((await ingest('fhir', { resourceType: 'Patient' }, key, 'application/fhir+json')).status).toBe(400);
    expect((await ingest('json', { heartRate: 70 })).status).toBe(400);
    expect((await ingest('mqtt', {})).status).toBe(400);
    expect(await prisma.patientVitals.count()).toBe(0);
  });
});

describe('tenant binding', () => {
  it("hospital A's key cannot write to hospital B's patient (422, nothing stored) nor to a soft-deleted patient", async () => {
    const res = await ingest('json', { patientCode: B.patient.patientCode, heartRate: 70 });
    expect(res.status).toBe(422);
    expect(res.body.data[0]).toMatchObject({ status: 'rejected', reason: 'PATIENT_NOT_FOUND' });
    const gone = await makePatient(A.hospital.id);
    await prisma.patient.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
    expect((await ingest('json', { patientCode: gone.patientCode, heartRate: 70 })).status).toBe(422);
    expect(await prisma.patientVitals.count()).toBe(0);
  });
});

describe('a critical device reading behaves like a critical manual one', () => {
  it('escalates the patient to CRITICAL, flags the reading and notifies only the hospital\'s doctors/nurses of the department', async () => {
    const res = await ingest('json', { patientCode: A.patient.patientCode, spO2: 82 });
    expect(res.status).toBe(201);
    expect(res.body.data[0].isCritical).toBe(true);
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: A.patient.id } })).status).toBe('CRITICAL');
    expect(await prisma.patientVitals.findFirstOrThrow({ where: { patientId: A.patient.id } })).toMatchObject({ isCritical: true });
    const notified = (await prisma.notification.findMany({ where: { type: 'VITALS' } })).map((n) => n.userId).sort();
    expect(notified).toEqual([A.doctor.id, A.nurse.id].sort());
    expect(await prisma.notification.count({ where: { userId: { in: [B.doctor.id, B.nurse.id, B.admin.id] } } })).toBe(0);
  });

  it('never touches a DISCHARGED patient, and a stable reading changes nothing', async () => {
    await prisma.patient.update({ where: { id: A.patient.id }, data: { status: 'DISCHARGED' } });
    await ingest('json', { patientCode: A.patient.patientCode, spO2: 80 });
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: A.patient.id } })).status).toBe('DISCHARGED');
    const other = await makePatient(A.hospital.id);
    await ingest('json', { patientCode: other.patientCode, heartRate: 72, spO2: 98 });
    expect((await prisma.patient.findUniqueOrThrow({ where: { id: other.id } })).status).toBe('OBSERVATION');
  });

  it('a hospital-specific threshold overrides the built-in default for its department', async () => {
    await prisma.vitalThresholds.create({ data: { hospitalId: A.hospital.id, department: 'ICU', vitalType: 'HEART_RATE', minCritical: 50, maxCritical: 110, alertEnabled: true } });
    const res = await ingest('json', { patientCode: A.patient.patientCode, heartRate: 120 }); // critical here, normal-ish under the default (130)
    expect(res.body.data[0].isCritical).toBe(true);
    const other = await makePatient(B.hospital.id);
    const keyB = (await call('post', '/api/devices', bearer(B.admin.id), { name: 'B' })).body.data.key;
    const resB = await ingest('json', { patientCode: other.patientCode, heartRate: 120 }, keyB);
    expect(resB.body.data[0].isCritical).toBe(false); // B has no override
  });
});
