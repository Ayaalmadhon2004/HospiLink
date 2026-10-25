// perf/contention.js
//
// Many clients fighting over the SAME rows, with the exact invariants checked afterwards (in teardown) against the data the API
// returns. Latency is secondary here: a single wrong number is a failed run (checks must be 100 %).
//
//   dispense  : 60 dispenses (20 at a time) of 1 unit from a stock of 25  -> exactly 25 succeed, stock ends at 0, ledger = -25
//   payments  : 40 payments of 1.00 against a 10.00 invoice               -> exactly 10 succeed, invoice PAID, never overpaid
//   issue     : 15 drafts issued at once                                  -> 15 distinct, consecutive INV numbers
//   admits    : 30 patients admitted at once                              -> 30 distinct patient codes, no 5xx
//
//   k6 run perf/contention.js            (-e PROFILE=load multiplies the pressure by 4)
import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';
import { ACCOUNTS, pick, jsonSummary } from './lib/config.js';
import { login, get, post, must, json, admitPatients } from './lib/api.js';

// 409 is a correct, expected answer here (that is the whole point); 5xx is not.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409));

const K = pick(1, 4);
const STOCK = 25 * K;
const DISPENSES = 60 * K;
const PAYMENT_ATTEMPTS = 40 * K;
const PAYABLE = 10 * K; // payments of 1.00 against an invoice of PAYABLE x 1.00
const DRAFTS = 15 * K;
const ADMITS = 30 * K;

export const options = {
  scenarios: {
    dispense: { executor: 'shared-iterations', exec: 'dispense', vus: 20, iterations: DISPENSES, maxDuration: '2m' },
    payments: { executor: 'shared-iterations', exec: 'pay', vus: 20, iterations: PAYMENT_ATTEMPTS, maxDuration: '2m' },
    issue: { executor: 'shared-iterations', exec: 'issue', vus: 15, iterations: DRAFTS, maxDuration: '2m' },
    admits: { executor: 'shared-iterations', exec: 'admit', vus: 15, iterations: ADMITS, maxDuration: '2m' },
  },
  thresholds: {
    checks: ['rate==1'],
    // 409 is a correct refusal here, so http_req_failed only counts what is NOT 2xx/409 (5xx, 4xx other than 409).
    http_req_failed: ['rate==0'],
  },
};

export function setup() {
  const run = `k6 contention ${Date.now()}`;
  const [admin, doctor, nurse] = [login(ACCOUNTS.admin), login(ACCOUNTS.doctor), login(ACCOUNTS.nurse)];
  const [patient] = admitPatients(admin, 1, run);

  // dispense: a medication with STOCK units and a prescription for it
  const med = must(post('/medications', { name: run, form: 'tablet', strength: '1 mg', unitPriceMinor: 100, reorderLevel: 1 }, admin), 201, 'create medication').data;
  must(post('/pharmacy/receive', { medicationId: med.id, quantity: STOCK, note: 'k6 setup' }, admin), 201, 'receive stock');
  const rx = must(post('/prescriptions', { patientId: patient.id, items: [{ medicationId: med.id, dose: '1', frequency: 'QD' }] }, doctor), 201, 'prescribe').data;

  // payments: one issued invoice of PAYABLE x 1.00
  const payInvoice = must(post('/billing/invoices', { patientId: patient.id }, admin), 201, 'create invoice').data;
  must(post(`/billing/invoices/${payInvoice.id}/lines`, { description: 'k6', quantity: 1, unitPriceMinor: PAYABLE * 100 }, admin), 201, 'add line');
  must(post(`/billing/invoices/${payInvoice.id}/issue`, {}, admin), 200, 'issue invoice');

  // issue: drafts, each with a line
  const drafts = [];
  for (let i = 0; i < DRAFTS; i++) {
    const d = must(post('/billing/invoices', { patientId: patient.id }, admin), 201, 'create draft').data;
    must(post(`/billing/invoices/${d.id}/lines`, { description: 'k6', quantity: 1, unitPriceMinor: 500 }, admin), 201, 'add draft line');
    drafts.push(d.id);
  }
  return { run, admin, doctor, nurse, med, itemId: rx.items[0].id, payInvoiceId: payInvoice.id, drafts };
}

export function dispense(data) {
  const res = post('/pharmacy/dispense', { prescriptionItemId: data.itemId, quantity: 1 }, data.nurse, 'dispense');
  const body = json(res);
  check(res, {
    'dispense: 201 or a clean 409': (r) => r.status === 201 || r.status === 409,
    'dispense: a 409 says INSUFFICIENT_STOCK': (r) => r.status !== 409 || (body && body.error && body.error.code === 'INSUFFICIENT_STOCK'),
  });
}

export function pay(data) {
  const res = post(`/billing/invoices/${data.payInvoiceId}/payments`, { amountMinor: 100, method: 'CASH' }, data.admin, 'payment');
  const body = json(res);
  check(res, {
    'payment: 201 or a clean 409': (r) => r.status === 201 || r.status === 409,
    'payment: a 409 says OVERPAYMENT': (r) => r.status !== 409 || (body && body.error && body.error.code === 'OVERPAYMENT'),
  });
}

export function issue(data) {
  // iterationInTest is global to the scenario (__ITER is per VU): shared-iterations hands each number out once, so every draft is issued exactly once
  const id = data.drafts[exec.scenario.iterationInTest];
  const res = post(`/billing/invoices/${id}/issue`, {}, data.admin, 'issue');
  check(res, { 'issue: 200': (r) => r.status === 200 });
}

export function admit(data) {
  const res = post('/patients/admit', { name: `${data.run} admit ${exec.scenario.iterationInTest}`, age: 33, gender: 'FEMALE', department: 'General', diagnosis: 'k6' }, data.admin, 'admit');
  check(res, { 'admit: 201': (r) => r.status === 201 });
}

export function teardown(data) {
  // ---- dispense: stock + ledger agree, nothing oversold
  const stock = json(get(`/pharmacy/stock?q=${encodeURIComponent(data.run)}`, data.admin, 'verify')).data.find((m) => m.id === data.med.id);
  const movements = json(get(`/pharmacy/movements?medicationId=${data.med.id}&type=DISPENSE&limit=200`, data.admin, 'verify')).data;
  const dispensed = movements.reduce((s, m) => s - m.delta, 0);
  check(null, {
    'dispense: exactly STOCK units were handed out': () => dispensed === STOCK,
    'dispense: stock ended at exactly 0 (never negative)': () => stock.stockQuantity === 0,
    'dispense: one ledger row per success': () => movements.length === STOCK,
  });

  // ---- payments: paid exactly the total, once, and is PAID
  const inv = json(get(`/billing/invoices/${data.payInvoiceId}`, data.admin, 'verify')).data;
  check(null, {
    'payments: exactly PAYABLE payments were accepted': () => inv.payments.length === PAYABLE,
    'payments: paid == total, never more': () => inv.paidMinor === inv.totalMinor && inv.totalMinor === PAYABLE * 100,
    'payments: the invoice is PAID': () => inv.status === 'PAID',
  });

  // ---- issue: distinct and consecutive numbers
  const numbers = data.drafts
    .map((id) => json(get(`/billing/invoices/${id}`, data.admin, 'verify')).data.number)
    .map((n) => parseInt(String(n).replace('INV-', ''), 10))
    .sort((a, b) => a - b);
  check(null, {
    'issue: every draft got a number': () => numbers.length === DRAFTS && numbers.every((n) => Number.isFinite(n)),
    'issue: numbers are distinct': () => new Set(numbers).size === DRAFTS,
    'issue: numbers are consecutive (no gap)': () => numbers[numbers.length - 1] - numbers[0] === DRAFTS - 1,
  });

  // ---- admits: distinct codes
  const mine = json(get('/patients?limit=200', data.admin, 'verify')).data.filter((p) => String(p.name).indexOf(`${data.run} admit`) === 0);
  check(null, {
    'admits: all patients were created': () => mine.length === ADMITS,
    'admits: patient codes are distinct': () => new Set(mine.map((p) => p.patientCode)).size === ADMITS,
  });
}

export const handleSummary = jsonSummary('contention');
