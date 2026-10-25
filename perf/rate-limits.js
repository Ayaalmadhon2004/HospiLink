// perf/rate-limits.js
//
// The abuse protections, proven under pressure instead of read in code: wrong-password hammering and request floods must be
// answered 429 RATE_LIMITED, with the per-IP windows of production (20 auth requests / 15 min, 200 API requests / min).
//
//   k6 run perf/rate-limits.js
//
// RUN IT AGAINST A SERVER WITH THE DEFAULT LIMITS (do NOT set AUTH_RATE_LIMIT_MAX / API_RATE_LIMIT_MAX), ON ITS OWN, ON A
// FRESH PROCESS: it deliberately exhausts the auth window for this IP for 15 minutes, so restart the API afterwards.
import http from 'k6/http';
import { check } from 'k6';
import { API, ACCOUNTS, jsonSummary } from './lib/config.js';
import { json } from './lib/api.js';

http.setResponseCallback(http.expectedStatuses(401, 429, { min: 200, max: 299 }));

export const options = {
  scenarios: { abuse: { executor: 'per-vu-iterations', vus: 1, iterations: 1, maxDuration: '2m' } },
  thresholds: { checks: ['rate==1'] },
};

export default function () {
  // 1. brute force: 30 wrong passwords against a real account. The first 20 are plain 401s, the rest 429.
  const statuses = [];
  for (let i = 0; i < 30; i++) {
    const res = http.post(`${API}/auth/login`, JSON.stringify({ email: ACCOUNTS.admin.email, password: `wrong-${i}` }), { headers: { 'Content-Type': 'application/json' }, tags: { name: 'bruteforce' } });
    statuses.push(res.status);
    if (res.status === 429) {
      const body = json(res);
      check(res, { 'a limited login answers RATE_LIMITED': () => !body || !body.error || body.error.code === 'RATE_LIMITED' });
    }
  }
  const unauthorized = statuses.filter((s) => s === 401).length;
  const limited = statuses.filter((s) => s === 429).length;
  check(null, {
    'at most 20 attempts are even evaluated (the rest are 429)': () => unauthorized <= 20,
    'the 21st+ attempt is refused with 429': () => limited >= 10,
    'no attempt ever succeeded': () => statuses.every((s) => s !== 200),
  });
  // even the RIGHT password is refused now: the window protects the account from a guessing run that happens to hit
  const right = http.post(`${API}/auth/login`, JSON.stringify(ACCOUNTS.admin), { headers: { 'Content-Type': 'application/json' }, tags: { name: 'bruteforce' } });
  check(right, { 'during the lockout window even the correct password gets 429': (r) => r.status === 429 });

  // 2. flood: 230 cheap requests in well under a minute; the general limiter lets 200 through per minute.
  const codes = [];
  for (let i = 0; i < 230; i++) codes.push(http.get(`${API}/health`, { tags: { name: 'flood' } }).status);
  check(null, {
    'a flood is cut off with 429 after about 200 requests': () => codes.filter((c) => c === 429).length >= 20,
    'requests under the limit were served normally': () => codes.slice(0, 150).every((c) => c === 200),
  });
}

export const handleSummary = jsonSummary('rate-limits');
