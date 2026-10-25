// Rate limiting of device ingestion. Own file: the limiters keep their counters in memory per module instance, so a fresh file
// gets fresh counters (the 60-failures test below would otherwise lock the loopback address for the other ingest tests).
import request from 'supertest';
import { resetDb, closeDb } from './helpers/db';
import { call, buildApp } from './helpers/app';
import { bearer, makeWorld } from './helpers/factories';

afterAll(closeDb);

type World = Awaited<ReturnType<typeof makeWorld>>;
let A: World;
let B: World;
let keyA: string;
let keyB: string;

const ingest = (key: string, code: string) =>
  request(buildApp()).post('/api/vitals/ingest/json').set('x-device-key', key).send({ patientCode: code, heartRate: 70 });

beforeAll(async () => {
  await resetDb();
  A = await makeWorld();
  B = await makeWorld();
  keyA = (await call('post', '/api/devices', bearer(A.admin.id), { name: 'A' })).body.data.key;
  keyB = (await call('post', '/api/devices', bearer(B.admin.id), { name: 'B' })).body.data.key;
});

describe('per-device-key limiter (INGEST_RATE_LIMIT_MAX = 40 in this suite)', () => {
  it('a device key gets its own budget: the 41st request in the minute is 429, another hospital\'s key is unaffected', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 44; i++) statuses.push((await ingest(keyA, A.patient.patientCode)).status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(40);
    expect(statuses.filter((s) => s === 429)).toHaveLength(4);
    expect(statuses.slice(0, 40).every((s) => s === 201)).toBe(true);
    // not per IP: the same address, a different authenticated device, still served
    expect((await ingest(keyB, B.patient.patientCode)).status).toBe(201);
  });
});

describe('failure limiter (60 rejected requests per minute per address)', () => {
  it('guessing keys is cut off after 60 rejections with 429, and the limiter state cannot be inflated by random keys', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 70; i++) statuses.push((await ingest(`hl_guess_${i}`, 'PT-1')).status);
    // The limiter counts every rejected response, including the 4 limited (429) requests of the previous test: the budget of 60
    // is therefore used up a few requests early. From then on EVERYTHING from this address is refused for the rest of the minute.
    const firstLimited = statuses.indexOf(429);
    expect(firstLimited).toBeGreaterThanOrEqual(50);
    expect(firstLimited).toBeLessThanOrEqual(60);
    expect(statuses.slice(0, firstLimited).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(firstLimited).every((s) => s === 429)).toBe(true);
    expect((await ingest(keyB, B.patient.patientCode)).status).toBe(429); // documented trade-off: a noisy bad client behind the same NAT blocks the good ones for a minute
  });
});
