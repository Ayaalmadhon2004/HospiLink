// perf/api-read.js
//
// What the screens do all day: lists and dashboards read by many staff at once (ramping virtual users, each doing a realistic
// mix with think time). Per-endpoint p95 budgets, because "average latency" hides the one slow list.
//
//   k6 run perf/api-read.js                       # smoke: up to 10 users, ~40 s
//   k6 run -e PROFILE=load perf/api-read.js       # up to 50 users, ~4 min
import { sleep, check } from 'k6';
import { ACCOUNTS, pick, intEnv, jsonSummary } from './lib/config.js';
import { login, get, post, must, admitPatients } from './lib/api.js';

const USERS = intEnv('USERS', pick(10, 50));
const PATIENTS = intEnv('PATIENTS', pick(30, 150));

export const options = {
  scenarios: {
    staff: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: pick(
        [{ duration: '10s', target: USERS }, { duration: '20s', target: USERS }, { duration: '10s', target: 0 }],
        [{ duration: '1m', target: USERS }, { duration: '2m', target: USERS }, { duration: '1m', target: 0 }],
      ),
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    http_req_duration: ['p(95)<600'],
    'http_req_duration{name:patients}': ['p(95)<500'],
    'http_req_duration{name:beds}': ['p(95)<500'],
    'http_req_duration{name:vitals}': ['p(95)<500'],
    'http_req_duration{name:notes}': ['p(95)<500'],
    'http_req_duration{name:stock}': ['p(95)<500'],
    'http_req_duration{name:invoices}': ['p(95)<500'],
    'http_req_duration{name:audit}': ['p(95)<800'],
    'http_req_duration{name:flow}': ['p(95)<800'],
  },
};

export function setup() {
  const [admin, doctor] = [login(ACCOUNTS.admin), login(ACCOUNTS.doctor)];
  const patients = admitPatients(admin, PATIENTS, `k6 read ${Date.now()}`);
  // a little clinical data so the lists are not empty
  patients.slice(0, 10).forEach((p, i) => {
    must(post('/clinical-notes', { patientId: p.id, type: 'PROGRESS', content: `k6 note ${i}` }, doctor), 201, 'seed note');
    must(post('/vitals', { patientId: p.id, heartRate: 70 + i, spO2: 97 }, doctor), 201, 'seed vitals');
  });
  must(post('/billing/invoices', { patientId: patients[0].id }, admin), 201, 'seed invoice');
  return { admin, doctor, patients };
}

// [weight, label, role, path builder]
const MIX = [
  [30, 'patients', 'admin', () => '/patients?limit=50'],
  [15, 'beds', 'admin', () => '/beds?limit=100'],
  [15, 'vitals', 'doctor', () => '/vitals?limit=50'],
  [10, 'notes', 'doctor', (d, i) => `/clinical-notes?patientId=${d.patients[i % 10].id}`],
  [8, 'stock', 'doctor', () => '/pharmacy/stock'],
  [8, 'invoices', 'admin', () => '/billing/invoices'],
  [6, 'audit', 'admin', () => '/audit-logs?limit=50'],
  [8, 'flow', 'admin', () => '/patients/flow?days=7'],
];
const TOTAL = MIX.reduce((s, m) => s + m[0], 0);

const choose = () => {
  let r = Math.random() * TOTAL;
  for (const m of MIX) {
    r -= m[0];
    if (r <= 0) return m;
  }
  return MIX[0];
};

export default function (data) {
  const [, label, role, path] = choose();
  const res = get(path(data, __ITER), data[role], label);
  check(res, { [`${label}: 200`]: (r) => r.status === 200 });
  sleep(0.5 + Math.random()); // think time: people read the screen
}

export const handleSummary = jsonSummary('api-read');
