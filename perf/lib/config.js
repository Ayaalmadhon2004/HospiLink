// perf/lib/config.js
//
// Shared settings. Everything is overridable with `k6 run -e NAME=value`.
//
// SAFETY: these scripts create patients, invoices and stock movements and hit the API hard. They only run against a local
// server unless you pass `-e ALLOW_REMOTE=true`, and even then use a throwaway database (docs/LOAD_TESTS.md).

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
export const API = `${BASE_URL}/api`;
export const ORIGIN = __ENV.ORIGIN || 'http://localhost:5173'; // must be in the server's CORS_ORIGINS (websocket handshake)

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/;
if (!LOCAL.test(BASE_URL) && __ENV.ALLOW_REMOTE !== 'true') {
  throw new Error(`Refusing to load-test ${BASE_URL}: it is not local. Pass -e ALLOW_REMOTE=true if you really mean a throwaway deployment.`);
}

// The throwaway accounts created by backend/prisma/seed.e2e.ts. Override for another database.
export const ACCOUNTS = {
  admin: { email: __ENV.ADMIN_EMAIL || 'e2e.admin@hospilink.test', password: __ENV.ADMIN_PASSWORD || 'E2e-Password-123!' },
  doctor: { email: __ENV.DOCTOR_EMAIL || 'e2e.doctor@hospilink.test', password: __ENV.DOCTOR_PASSWORD || 'E2e-Password-123!' },
  nurse: { email: __ENV.NURSE_EMAIL || 'e2e.nurse@hospilink.test', password: __ENV.NURSE_PASSWORD || 'E2e-Password-123!' },
};

// smoke = a minute-ish sanity run (CI); load = the numbers in docs/LOAD_TESTS.md.
export const PROFILE = __ENV.PROFILE === 'load' ? 'load' : 'smoke';
export const pick = (smoke, load) => (PROFILE === 'load' ? load : smoke);

export const intEnv = (name, fallback) => {
  const n = parseInt(__ENV[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const fmt = (v) => (typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)) : String(v));

/** A compact, dependency-free console summary: thresholds first (pass/fail), then the headline numbers of every metric. */
const textSummary = (name, data) => {
  const lines = [`\n=== ${name} (${PROFILE} profile) ===`];
  const failed = [];
  Object.keys(data.metrics).forEach((metric) => {
    const m = data.metrics[metric];
    Object.keys(m.thresholds || {}).forEach((expr) => {
      lines.push(`  ${m.thresholds[expr].ok ? 'PASS' : 'FAIL'}  ${metric}  ${expr}`);
      if (!m.thresholds[expr].ok) failed.push(`${metric} ${expr}`);
    });
  });
  // every check that failed at least once, with its counts (k6 hides which assertion tripped the `checks` threshold)
  const badChecks = [];
  const walk = (group) => {
    (group.checks || []).forEach((c) => { if (c.fails > 0) badChecks.push(`  FAILED CHECK  ${c.name}  (passes=${c.passes}, fails=${c.fails})`); });
    (group.groups || []).forEach(walk);
  };
  if (data.root_group) walk(data.root_group);
  badChecks.forEach((l) => lines.push(l));
  lines.push('');
  Object.keys(data.metrics)
    .filter((k) => k.indexOf('{') === -1 && k.indexOf('iteration') !== 0 && k !== 'vus_max')
    .sort()
    .forEach((k) => {
      const v = data.metrics[k].values;
      if (v['p(95)'] !== undefined) lines.push(`  ${k.padEnd(32)} avg=${fmt(v.avg)} med=${fmt(v.med)} p95=${fmt(v['p(95)'])} p99=${fmt(v['p(99)'] === undefined ? v.max : v['p(99)'])} max=${fmt(v.max)}`);
      else if (v.count !== undefined) lines.push(`  ${k.padEnd(32)} count=${v.count}${v.rate ? ` (${fmt(v.rate)}/s)` : ''}`);
      else if (v.rate !== undefined) lines.push(`  ${k.padEnd(32)} rate=${fmt(v.rate * 100)}%`);
    });
  lines.push(failed.length ? `\nRESULT: FAILED (${failed.length} threshold(s))\n` : '\nRESULT: all thresholds passed\n');
  return lines.join('\n');
};

/** Console summary + (when SUMMARY_JSON=<path> is set, `{name}` is replaced) a JSON file for CI artifacts. */
export const jsonSummary = (name) => (data) => {
  const out = { stdout: textSummary(name, data) };
  if (__ENV.SUMMARY_JSON) out[__ENV.SUMMARY_JSON.replace('{name}', name)] = JSON.stringify(data, null, 2);
  return out;
};
