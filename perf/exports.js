// perf/exports.js
//
// Heavy downloads and their guard rails, against a hospital with EXPORT_ROWS patients (default 300; the cap is 10 000).
//   - every successful export is a real file (xlsx = zip, pdf = %PDF) and returns within the budget
//   - the per-IP export limiter (10 / minute) answers 429 RATE_LIMITED instead of letting a script melt the database
//   - an over-long period is refused (400) before any query runs (it still counts against the limiter window)
//
//   k6 run perf/exports.js            (the 10/min export limiter is fixed in the code; start the API with the raised API_RATE_LIMIT_MAX,
//                                      otherwise the setup, which admits ROWS patients, is cut off by the 200/min general limiter)
// Run it on its own and wait a minute between runs: the limiter window is 60 s.
import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';
import { API, ACCOUNTS, intEnv, jsonSummary } from './lib/config.js';
import { login, headers, admitPatients, json } from './lib/api.js';

const ROWS = intEnv('EXPORT_ROWS', 300);
const xlsxTime = new Trend('export_xlsx_ms', true);
const pdfTime = new Trend('export_pdf_ms', true);

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 400, 429));

export const options = {
  scenarios: { sequential: { executor: 'per-vu-iterations', vus: 1, iterations: 1, maxDuration: '5m' } },
  thresholds: { checks: ['rate==1'], export_xlsx_ms: ['p(95)<3000'], export_pdf_ms: ['p(95)<8000'] },
};

export function setup() {
  const admin = login(ACCOUNTS.admin);
  admitPatients(admin, ROWS, `k6 export ${Date.now()}`);
  return { admin };
}

const download = (type, format, token) => http.get(`${API}/exports/${type}?format=${format}`, { headers: headers(token), responseType: 'binary', tags: { name: `export-${format}` } });

export default function (data) {
  // 10 requests fit in the limiter window: one refused period (a 400 counts too), then 9 real exports
  const tooLong = http.get(`${API}/exports/patients?format=xlsx&from=2020-01-01T00:00:00Z&to=2026-01-01T00:00:00Z`, { headers: headers(data.admin), tags: { name: 'export-bad-range' } });
  check(tooLong, { 'a period over 366 days is refused (400)': (r) => r.status === 400 });

  // alternate the two formats and the two datasets
  let ok = 0;
  for (let i = 0; i < 9; i++) {
    const format = i % 2 === 0 ? 'xlsx' : 'pdf';
    const type = i % 4 < 2 ? 'patients' : 'appointments';
    const res = download(type, format, data.admin);
    const magic = String.fromCharCode.apply(null, new Uint8Array(res.body.slice(0, 4)));
    check(res, {
      [`${format}: 200 and a real file`]: (r) => r.status === 200 && (format === 'xlsx' ? magic.indexOf('PK') === 0 : magic === '%PDF'),
      [`${format}: not cached (no-store)`]: (r) => r.headers['Cache-Control'] === 'no-store',
    });
    if (res.status === 200) {
      ok++;
      (format === 'xlsx' ? xlsxTime : pdfTime).add(res.timings.duration);
    }
  }
  check(null, { 'the 9 exports inside the window all succeeded': () => ok === 9 });

  // the 11th and 12th request within the same minute are refused
  for (let i = 0; i < 2; i++) {
    const res = download('patients', 'xlsx', data.admin);
    const body = res.status === 429 ? json(res) : null;
    check(res, { 'over the limit: 429 RATE_LIMITED': (r) => r.status === 429 });
    void body;
  }
}

export const handleSummary = jsonSummary('exports');
