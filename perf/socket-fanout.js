// perf/socket-fanout.js
//
// Real-time fan-out: RECEIVERS staff browsers hold a socket.io connection and follow one patient; a bedside device then pushes
// READINGS vitals. Every reading must reach every follower (no loss), fast (end-to-end p95), over the real WebSocket path:
// device ingest -> pipeline -> socket.io room `patient-<id>` -> client. The latency is measured from the reading's own
// timestamp (observedAt = send time, echoed back as recordedAt), so it includes the database insert.
//
//   k6 run perf/socket-fanout.js                         # smoke: 20 receivers, 10 readings
//   k6 run -e PROFILE=load -e RECEIVERS=300 perf/socket-fanout.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { API, ACCOUNTS, pick, intEnv, jsonSummary } from './lib/config.js';
import { login, must, post, admitPatients } from './lib/api.js';
import { connect } from './lib/socketio.js';

const RECEIVERS = intEnv('RECEIVERS', pick(20, 100));
const READINGS = intEnv('READINGS', pick(10, 30));
const INTERVAL_S = 0.5; // readings per second = 2
const SENDER_START_S = 8; // receivers need a moment to connect and join the room
const WINDOW_S = SENDER_START_S + Math.ceil(READINGS * INTERVAL_S) + 8;

const latency = new Trend('fanout_latency_ms', true);
const delivered = new Rate('all_events_delivered');
const connected = new Rate('socket_connected');
const received = new Counter('fanout_events_received');

export const options = {
  scenarios: {
    receivers: { executor: 'per-vu-iterations', exec: 'receiver', vus: RECEIVERS, iterations: 1, maxDuration: `${WINDOW_S + 20}s` },
    sender: { executor: 'per-vu-iterations', exec: 'sender', vus: 1, iterations: 1, startTime: `${SENDER_START_S}s`, maxDuration: `${WINDOW_S}s` },
  },
  thresholds: {
    socket_connected: ['rate==1'],
    all_events_delivered: ['rate==1'], // every receiver got every reading
    fanout_latency_ms: ['p(95)<500', 'p(99)<1500'],
    checks: ['rate==1'],
  },
};

export function setup() {
  const [admin, nurse] = [login(ACCOUNTS.admin), login(ACCOUNTS.nurse)];
  const [patient] = admitPatients(admin, 1, `k6 fanout ${Date.now()}`);
  const key = must(post('/devices', { name: `k6 fanout ${Date.now()}` }, admin), 201, 'create device key').data.key;
  return { token: nurse, patient, key };
}

export function receiver(data) {
  let got = 0;
  let ready = false;
  connect(data.token, {
    maxMs: WINDOW_S * 1000,
    onReady: (socket) => {
      ready = true;
      socket.emit('join-room', data.patient.id); // follow this patient
    },
    onRefused: () => {},
    onEvent: (name, payload, socket) => {
      if (name !== 'new-vital') return;
      got++;
      received.add(1);
      latency.add(Date.now() - Date.parse(payload.recordedAt));
      if (got >= READINGS) socket.close();
    },
  });
  connected.add(ready);
  delivered.add(got === READINGS);
}

export function sender(data) {
  for (let i = 0; i < READINGS; i++) {
    const res = http.post(
      `${API}/vitals/ingest/json`,
      JSON.stringify({ patientCode: data.patient.patientCode, heartRate: 70 + (i % 20), spO2: 97, observedAt: new Date().toISOString() }),
      { headers: { 'Content-Type': 'application/json', 'x-device-key': data.key }, tags: { name: 'ingest' } },
    );
    check(res, { 'reading accepted (201)': (r) => r.status === 201 });
    sleep(INTERVAL_S);
  }
}

export const handleSummary = jsonSummary('socket-fanout');
