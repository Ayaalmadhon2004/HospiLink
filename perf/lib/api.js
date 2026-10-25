// perf/lib/api.js
import http from 'k6/http';
import { check, fail } from 'k6';
import { API } from './config.js';

const RATE_LIMIT_HINT =
  'The API answered 429. Start it with AUTH_RATE_LIMIT_MAX=100000 API_RATE_LIMIT_MAX=1000000 (test-only env overrides), ' +
  'otherwise the per-IP limiter caps one k6 machine at 200 requests/minute. Production limits stay untouched.';

export const headers = (token, extra) => Object.assign({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, extra || {});

/** `name` groups URLs with ids/queries under one label in the results (otherwise k6 creates one series per URL). */
export const get = (path, token, name) => http.get(`${API}${path}`, { headers: headers(token), tags: { name: name || path } });
export const post = (path, body, token, name, extraHeaders) =>
  http.post(`${API}${path}`, typeof body === 'string' ? body : JSON.stringify(body), { headers: headers(token, extraHeaders), tags: { name: name || path } });
export const put = (path, body, token, name) => http.put(`${API}${path}`, JSON.stringify(body), { headers: headers(token), tags: { name: name || path } });

export const json = (res) => {
  try {
    return res.json();
  } catch (e) {
    return null;
  }
};

/** Fails the whole run early (in setup) with a readable reason. */
export const must = (res, expected, what) => {
  if (res.status === 429) fail(`${what}: ${RATE_LIMIT_HINT}`);
  if (res.status !== expected) fail(`${what}: expected HTTP ${expected}, got ${res.status} ${String(res.body).slice(0, 300)}`);
  return json(res);
};

export const login = (account) => {
  const res = http.post(`${API}/auth/login`, JSON.stringify({ email: account.email, password: account.password }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'login' },
  });
  return must(res, 200, `login ${account.email}`).data.token;
};

export const status = (res, ...allowed) => allowed.indexOf(res.status) !== -1;

/** Admits `count` patients in parallel batches (the server serialises code allocation: a good concurrent-admit check in itself). */
export const admitPatients = (token, count, label) => {
  const out = [];
  const BATCH = 10;
  for (let start = 0; start < count; start += BATCH) {
    const reqs = [];
    for (let i = start; i < Math.min(count, start + BATCH); i++) {
      reqs.push(['POST', `${API}/patients/admit`, JSON.stringify({ name: `${label} ${i}`, age: 30 + (i % 50), gender: i % 2 ? 'MALE' : 'FEMALE', department: 'General', diagnosis: 'k6 load test' }), { headers: headers(token), tags: { name: 'admit' } }]);
    }
    http.batch(reqs).forEach((res) => {
      const body = must(res, 201, 'admit patient');
      out.push({ id: body.data.id, patientCode: body.data.patientCode, name: body.data.name });
    });
  }
  return out;
};

export const okCheck = (res, name, ...allowed) => check(res, { [`${name}: status ${allowed.join('/')}`]: (r) => allowed.indexOf(r.status) !== -1 });
