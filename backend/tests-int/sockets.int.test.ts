// Socket.io end to end: the real server process, real JWT handshake, real rooms, real database. Events are triggered through
// the HTTP API (as the app does) and observed by socket.io clients of several hospitals and roles.
import type { Socket } from 'socket.io-client';
import { prisma, resetDb, closeDb } from './helpers/db';
import { makeWorld, makeUser, makeStaff, makePatient, tokenFor } from './helpers/factories';
import { startServer, connectAs, connectUser, nextEvent, record, settle, http, RunningServer } from './helpers/server';

type World = Awaited<ReturnType<typeof makeWorld>>;
let server: RunningServer;
let A: World;
let B: World;
let open: Socket[] = [];

const connect = async (userId: string, age = 0): Promise<Socket> => {
  const s = await connectUser(server, userId, age);
  open.push(s);
  return s;
};

beforeAll(async () => {
  server = await startServer();
}, 60_000);

afterAll(async () => {
  await server.stop();
  await closeDb();
});

beforeEach(async () => {
  await resetDb();
  A = await makeWorld();
  B = await makeWorld();
});

afterEach(() => {
  open.forEach((s) => s.disconnect());
  open = [];
});

describe('handshake (socketAuth)', () => {
  it('accepts a valid token', async () => {
    const s = await connect(A.doctor.id);
    expect(s.connected).toBe(true);
  });

  it('refuses no token, a forged token and a token for a user that does not exist', async () => {
    await expect(connectAs(server, '')).rejects.toThrow(/Unauthorized/);
    await expect(connectAs(server, 'not.a.jwt')).rejects.toThrow(/Unauthorized/);
    await expect(connectAs(server, tokenFor('00000000-0000-4000-8000-000000000000'))).rejects.toThrow();
  });

  it('refuses PENDING and DISABLED accounts', async () => {
    const pending = await makeUser(A.hospital.id, 'NURSE', { accountStatus: 'PENDING' });
    const disabled = await makeUser(A.hospital.id, 'NURSE', { accountStatus: 'DISABLED' });
    await expect(connectUser(server, pending.id)).rejects.toThrow(/pending|approval|Unauthorized|Forbidden/i);
    await expect(connectUser(server, disabled.id)).rejects.toThrow();
  });

  it('a role change signs the user out of sockets too: a token issued before it can no longer connect', async () => {
    const old = tokenFor(A.nurse.id, 30); // issued 30 s ago
    await expect(connectAs(server, old)).resolves.toBeDefined().then(() => undefined);
    const res = await http(server, 'PUT', `/api/users/${A.nurse.id}/role`, A.admin.id, { role: 'DOCTOR' });
    expect(res.status).toBe(200);
    await expect(connectAs(server, old)).rejects.toThrow(/Unauthorized/);
    const fresh = await connect(A.nurse.id); // a new login works, with the new role
    expect(fresh.connected).toBe(true);
  });
});

describe('clinical events and tenant isolation', () => {
  const deviceKey = async (adminId: string): Promise<string> => (await http(server, 'POST', '/api/devices', adminId, { name: 'monitor' })).body.data.key;
  const critical = (key: string, code: string) =>
    http(server, 'POST', '/api/vitals/ingest/json', null, { patientCode: code, spO2: 80 }, { 'x-device-key': key });

  it('new-vital reaches followers of the patient only; join-room is refused for another hospital\'s patient', async () => {
    const key = await deviceKey(A.admin.id);
    const [docA, nurseA, docB] = await Promise.all([connect(A.doctor.id), connect(A.nurse.id), connect(B.doctor.id)]);
    docA.emit('join-room', A.patient.id);
    docB.emit('join-room', A.patient.id); // tries to follow hospital A's patient
    await settle();
    const [gotA, gotB, notFollowing] = [nextEvent(docA, 'new-vital'), nextEvent(docB, 'new-vital', 1000), nextEvent(nurseA, 'new-vital', 1000)];
    expect((await critical(key, A.patient.patientCode)).status).toBe(201);
    expect(await gotA).toMatchObject({ patientId: A.patient.id, spO2: 80 });
    expect(await gotB).toBeNull();
    expect(await notFollowing).toBeNull(); // nurse A never joined the patient room
  });

  it('patient-status-changed goes to the whole clinical staff of the hospital, to nobody else (other hospital, dispatcher)', async () => {
    const dispatcherA = await makeUser(A.hospital.id, 'DISPATCHER');
    const key = await deviceKey(A.admin.id);
    const sockets = await Promise.all([connect(A.admin.id), connect(A.doctor.id), connect(A.nurse.id), connect(dispatcherA.id), connect(B.doctor.id), connect(B.admin.id)]);
    const [adminA, docA, nurseA, dispA, docB, adminB] = sockets;
    const waits = sockets.map((s) => nextEvent<{ patientId: string; status: string }>(s, 'patient-status-changed', 1500));
    await critical(key, A.patient.patientCode);
    const [rAdmin, rDoc, rNurse, rDisp, rDocB, rAdminB] = await Promise.all(waits);
    for (const r of [rAdmin, rDoc, rNurse]) expect(r).toMatchObject({ patientId: A.patient.id, status: 'CRITICAL' });
    expect(rDisp).toBeNull();
    expect(rDocB).toBeNull();
    expect(rAdminB).toBeNull();
    void [adminA, docA, nurseA, dispA, docB, adminB];
  });

  it('new-notification is pushed to the doctor and nurse of the department (user rooms), not to admins or other hospitals', async () => {
    const key = await deviceKey(A.admin.id);
    const [adminA, docA, nurseA, docB] = await Promise.all([connect(A.admin.id), connect(A.doctor.id), connect(A.nurse.id), connect(B.doctor.id)]);
    const waits = [adminA, docA, nurseA, docB].map((s) => nextEvent<{ type: string; userId: string; title: string }>(s, 'new-notification', 1500));
    await critical(key, A.patient.patientCode);
    const [rAdmin, rDoc, rNurse, rDocB] = await Promise.all(waits);
    expect(rDoc).toMatchObject({ type: 'VITALS', userId: A.doctor.id, title: 'Critical vitals alert' });
    expect(rNurse).toMatchObject({ type: 'VITALS', userId: A.nurse.id });
    expect(rAdmin).toBeNull();
    expect(rDocB).toBeNull();
  });

  it('incident events go to the clinical room of the same hospital only', async () => {
    const dispatcherA = await makeUser(A.hospital.id, 'DISPATCHER');
    const [nurseA, adminA, dispA, adminB] = await Promise.all([connect(A.nurse.id), connect(A.admin.id), connect(dispatcherA.id), connect(B.admin.id)]);
    const waits = [nurseA, adminA, dispA, adminB].map((s) => nextEvent<{ title: string }>(s, 'incident-created', 1500));
    const res = await http(server, 'POST', '/api/incidents', A.doctor.id, { title: 'Fire drill', type: 'SECURITY', severity: 'LOW', location: 'Lobby', reportedBy: 'Dr A' });
    expect(res.status).toBe(201);
    const [rNurse, rAdmin, rDisp, rAdminB] = await Promise.all(waits);
    expect(rNurse).toMatchObject({ title: 'Fire drill' });
    expect(rAdmin).toMatchObject({ title: 'Fire drill' });
    expect(rDisp).toBeNull();
    expect(rAdminB).toBeNull();
  });

  it('shift updates reach only the sockets that joined that department in that hospital', async () => {
    const staff = await makeStaff(A.hospital.id, { department: 'ICU' });
    const [docA, nurseA, docB] = await Promise.all([connect(A.doctor.id), connect(A.nurse.id), connect(B.doctor.id)]);
    docA.emit('join-department', 'ICU');
    docB.emit('join-department', 'ICU'); // same department NAME, other hospital
    await settle();
    const waits = [docA, nurseA, docB].map((s) => nextEvent<{ department: string }>(s, 'shift-update', 1500));
    const start = new Date(Date.now() + 24 * 3_600_000);
    const res = await http(server, 'POST', '/api/staff/shifts', A.admin.id, { staffId: staff.id, type: 'DAY', startTime: start.toISOString(), endTime: new Date(start.getTime() + 8 * 3_600_000).toISOString(), department: 'ICU' });
    expect(res.status).toBe(201);
    const [rDoc, rNurse, rDocB] = await Promise.all(waits);
    expect(rDoc).toMatchObject({ department: 'ICU' });
    expect(rNurse).toBeNull();
    expect(rDocB).toBeNull();
  });
});

describe('dispatch rooms', () => {
  it('unit events reach dispatchers/admins who joined, never another hospital; track-unit refuses foreign units', async () => {
    const dispatcherA = await makeUser(A.hospital.id, 'DISPATCHER');
    const dispatcherB = await makeUser(B.hospital.id, 'DISPATCHER');
    const [dA, dB, nurseA, adminA] = await Promise.all([connect(dispatcherA.id), connect(dispatcherB.id), connect(A.nurse.id), connect(A.admin.id)]);
    adminA.emit('join-dispatch'); // a second hospital-A observer: a sender does not receive its own broadcast
    dA.emit('join-dispatch');
    dB.emit('join-dispatch');
    nurseA.emit('join-dispatch'); // a nurse may not
    await settle();
    const waits = [dA, dB, nurseA].map((s) => nextEvent<{ unitCode?: string }>(s, 'unit-created', 1500));
    const res = await http(server, 'POST', '/api/dispatch/units', dispatcherA.id, { unitCode: 'AMB-1', unitType: 'AMBULANCE', department: 'ER', crewIds: [] });
    expect(res.status).toBe(201);
    const [rA, rB, rNurse] = await Promise.all(waits);
    expect(rA).toMatchObject({ unitCode: 'AMB-1' });
    expect(rB).toBeNull();
    expect(rNurse).toBeNull();

    // location pings: only a dispatcher of the SAME hospital can move a unit; the broadcast reaches only that hospital
    const unitId = res.body.data.id as string;
    dA.emit('track-unit', unitId);
    dB.emit('track-unit', unitId); // foreign unit: refused
    await settle();
    const locA = nextEvent(adminA, 'unit-location', 1500);
    const locB = nextEvent(dB, 'unit-location', 1000);
    dA.emit('unit-location-update', { unitId, lat: 31.95, lng: 35.93, status: 'EN_ROUTE' });
    expect(await locA).toMatchObject({ unitId, lat: 31.95, lng: 35.93 });
    expect(await locB).toBeNull();
    const evil = nextEvent(adminA, 'unit-location', 800);
    dB.emit('unit-location-update', { unitId, lat: 0, lng: 0, status: 'EN_ROUTE' }); // hospital B moving A's unit
    expect(await evil).toBeNull();
    expect((await prisma.dispatchUnit.findUniqueOrThrow({ where: { id: unitId } })).lat).toBeCloseTo(31.95);
  });
});

describe('fan-out does not leak through reconnects or repeated joins', () => {
  it('a socket that joins a foreign patient room and then a legitimate one only gets the legitimate patient\'s events', async () => {
    const mine = A.patient;
    const other = await makePatient(B.hospital.id);
    const key = (await http(server, 'POST', '/api/devices', B.admin.id, { name: 'b monitor' })).body.data.key as string;
    const docA = await connect(A.doctor.id);
    docA.emit('join-room', other.id); // refused (other hospital)
    docA.emit('join-room', mine.id);
    await settle();
    const seen = record<{ patientId: string }>(docA, 'new-vital');
    await http(server, 'POST', '/api/vitals/ingest/json', null, { patientCode: other.patientCode, heartRate: 70 }, { 'x-device-key': key });
    await settle(700);
    expect(seen).toHaveLength(0);
  });
});
