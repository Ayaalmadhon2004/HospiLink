// perf/vitals-ingest.js
//
// Bedside devices pushing readings: DEVICES devices x 1 reading/second (default 50 -> 50 req/s) through a single device
// key, mixing the three protocols (JSON single, JSON batch of 3, HL7 v2). 2% of the readings are critical, so the alerting
// path (escalate patient + notify doctors/nurses) is exercised too, not just the insert.
//
//   k6 run perf/vitals-ingest.js                      # smoke: 10 devices for 20 s
//   k6 run -e PROFILE=load perf/vitals-ingest.js      # 50 devices for 2 min
//   -e DEVICES=100 -e DURATION=5m                      # custom
//
// Thresholds (the contract): p95 < 300 ms, p99 < 800 ms, < 1 % failures, no dropped iterations (the server kept up).
import http from 'k6/http';
import exec from 'k6/execution';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { API, ACCOUNTS, pick, intEnv, jsonSummary } from './lib/config.js';
import { login, post, must, admitPatients, json } from './lib/api.js';

const DEVICES = intEnv('DEVICES', pick(10, 50));
const DURATION = __ENV.DURATION || pick('20s', '2m');
const PATIENTS = intEnv('PATIENTS', 20);
const criticalSent = new Counter('critical_readings_sent');
const readingsStored = new Counter('readings_stored');

export const options = {
  scenarios: {
    devices: {
      executor: 'constant-arrival-rate',
      rate: DEVICES, // one reading per device per second
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: DEVICES,
      maxVUs: DEVICES * 3,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:ingest}': ['p(95)<300', 'p(99)<800'],
    checks: ['rate>0.99'],
    dropped_iterations: ['count==0'],
  },
};

export function setup() {
  const admin = login(ACCOUNTS.admin);
  const patients = admitPatients(admin, PATIENTS, `k6 ingest ${Date.now()}`);
  const key = must(post('/devices', { name: `k6 ${Date.now()}` }, admin), 201, 'create device key').data.key;
  return { patients, key };
}

const hl7 = (code, hr, spo2) =>
  ['MSH|^~\\&|K6|ICU|HOSPILINK|HL|20260101120000||ORU^R01|1|P|2.5', `PID|1||${code}`, `OBX|1|NM|8867-4^HR^LN||${hr}|/min`, `OBX|2|NM|2708-6^SpO2^LN||${spo2}|%`].join('\r');

export default function (data) {
  const n = exec.scenario.iterationInTest;
  const patient = data.patients[n % data.patients.length];
  const critical = n % 50 === 7; // 2 %
  const spo2 = critical ? 82 : 96 + (n % 3);
  const hr = 60 + (n % 35);
  const common = { headers: { 'x-device-key': data.key }, tags: { name: 'ingest' } };
  let res;
  let expected = 1;

  if (n % 3 === 0) {
    res = http.post(`${API}/vitals/ingest/hl7`, hl7(patient.patientCode, hr, spo2), { ...common, headers: { ...common.headers, 'Content-Type': 'text/plain' } });
  } else if (n % 3 === 1) {
    const readings = [0, 1, 2].map((k) => ({ patientCode: data.patients[(n + k) % data.patients.length].patientCode, heartRate: hr + k, spO2: 97 }));
    expected = readings.length;
    res = http.post(`${API}/vitals/ingest/json`, JSON.stringify({ readings }), { ...common, headers: { ...common.headers, 'Content-Type': 'application/json' } });
  } else {
    res = http.post(`${API}/vitals/ingest/json`, JSON.stringify({ patientCode: patient.patientCode, heartRate: hr, spO2: spo2, temperature: 36.8 }), { ...common, headers: { ...common.headers, 'Content-Type': 'application/json' } });
  }

  const body = json(res);
  const stored = body && body.data ? body.data.filter((o) => o.status === 'stored').length : 0;
  check(res, {
    'ingest: 201 Created': (r) => r.status === 201,
    'ingest: every reading of the request stored': () => stored === expected,
  });
  readingsStored.add(stored);
  if (critical && n % 3 !== 1) criticalSent.add(1);
}

export const handleSummary = jsonSummary('vitals-ingest');
