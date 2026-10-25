// backend/src/services/vitalsAdapters.ts
//
// Protocol adapters: each turns a wire format into normalised IncomingReading[] (see vitalsIngest.ts).
// They are pure (no DB, no sockets) so adding a protocol = one function here + one entry in ADAPTERS.
// MQTT is not spoken by the API: run a broker bridge (e.g. Mosquitto/EMQX rule, Node-RED) that POSTs each
// message to /api/vitals/ingest/json (or /fhir, /hl7) with the x-device-key header. See docs/VITALS_INTEGRATION.md.
import type { IncomingReading, MetricValues } from './vitalsIngest';

export class IngestParseError extends Error {}

export const PROTOCOLS = ['hl7', 'fhir', 'json'] as const;
export type Protocol = (typeof PROTOCOLS)[number];

type MetricKey = keyof MetricValues;
const INT_KEYS: MetricKey[] = ['heartRate', 'systolicBP', 'diastolicBP', 'respiratoryRate'];

// LOINC codes of the vitals HospiLink stores.
const LOINC: Record<string, MetricKey | 'bloodPressure'> = {
  '8867-4': 'heartRate',
  '8480-6': 'systolicBP',
  '8462-4': 'diastolicBP',
  '85354-9': 'bloodPressure', // BP panel: "120/80" (HL7) or systolic/diastolic components (FHIR)
  '2708-6': 'spO2',
  '59408-5': 'spO2',
  '8310-5': 'temperature',
  '9279-1': 'respiratoryRate',
};

const toNumber = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.trim()) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

const setMetric = (values: MetricValues, key: MetricKey, raw: unknown, unit?: string): void => {
  let n = toNumber(raw);
  if (n === undefined) return;
  if (key === 'temperature' && unit && /degf|\[degf\]|°f/i.test(unit)) n = Math.round(((n - 32) * 5 / 9) * 10) / 10; // stored in °C
  values[key] = INT_KEYS.includes(key) ? Math.round(n) : n;
};

const setBloodPressure = (values: MetricValues, raw: unknown): void => {
  const m = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(String(raw));
  if (!m) return;
  setMetric(values, 'systolicBP', m[1]);
  setMetric(values, 'diastolicBP', m[2]);
};

// Several observations for the same patient in one message become ONE reading.
const merge = (readings: IncomingReading[]): IncomingReading[] => {
  const byPatient = new Map<string, IncomingReading>();
  for (const r of readings) {
    const cur = byPatient.get(r.patientCode);
    if (!cur) byPatient.set(r.patientCode, { ...r, values: { ...r.values } });
    else Object.assign(cur.values, r.values);
  }
  return [...byPatient.values()];
};

// ---- HL7 v2 (ORU^R01): PID-3 = patient code, OBX-3 = LOINC, OBX-5 = value, OBX-6 = unit, OBX-14 = time ----
const hl7Time = (v: string | undefined): Date | undefined => {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/.exec(v ?? '');
  if (!m) return undefined;
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`); // device clocks are treated as UTC
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const parseHl7 = (body: unknown): IncomingReading[] => {
  if (typeof body !== 'string' || !body.startsWith('MSH')) throw new IngestParseError('Expected an HL7 v2 message starting with MSH');
  const segments = body.split(/\r\n|\r|\n/).filter(Boolean).map((l) => l.split('|'));
  const msh = segments[0];
  if (!/^ORU\^R01/.test(msh[8] ?? '')) throw new IngestParseError('Only ORU^R01 messages are supported');
  const readings: IncomingReading[] = [];
  let current: IncomingReading | null = null;
  for (const f of segments) {
    if (f[0] === 'PID') {
      const patientCode = (f[3] ?? '').split('~')[0].split('^')[0].trim();
      if (!patientCode) throw new IngestParseError('PID-3 (patient identifier) is empty');
      current = { patientCode, values: {} };
      readings.push(current);
    } else if (f[0] === 'OBX' && current) {
      const key = LOINC[(f[3] ?? '').split('^')[0]];
      if (!key) continue;
      if (key === 'bloodPressure') setBloodPressure(current.values, f[5]);
      else setMetric(current.values, key, f[5], (f[6] ?? '').split('^')[0]);
      current.observedAt ??= hl7Time(f[14]);
    }
  }
  if (readings.length === 0) throw new IngestParseError('No PID segment found');
  return merge(readings);
};

// ---- FHIR R4: Observation, or Bundle of Observations ----
interface FhirCoding { system?: string; code?: string }
interface FhirQuantity { value?: number; unit?: string; code?: string }
interface FhirObservation {
  resourceType?: string;
  code?: { coding?: FhirCoding[] };
  subject?: { reference?: string; identifier?: { value?: string } };
  effectiveDateTime?: string;
  valueQuantity?: FhirQuantity;
  component?: { code?: { coding?: FhirCoding[] }; valueQuantity?: FhirQuantity }[];
}

const loincOf = (c?: { coding?: FhirCoding[] }) => LOINC[c?.coding?.find((x) => x.code && LOINC[x.code])?.code ?? ''];

export const parseFhir = (body: unknown): IncomingReading[] => {
  const root = body as { resourceType?: string; entry?: { resource?: FhirObservation }[] } | null;
  const observations: FhirObservation[] =
    root?.resourceType === 'Bundle'
      ? (root.entry ?? []).map((e) => e.resource).filter((r): r is FhirObservation => r?.resourceType === 'Observation')
      : root?.resourceType === 'Observation'
        ? [root as FhirObservation]
        : [];
  if (observations.length === 0) throw new IngestParseError('Expected a FHIR Observation or a Bundle containing Observations');
  const readings: IncomingReading[] = [];
  for (const o of observations) {
    const patientCode = o.subject?.identifier?.value ?? o.subject?.reference?.replace(/^Patient\//, '');
    if (!patientCode) throw new IngestParseError('Observation.subject needs an identifier or a Patient/<code> reference');
    const values: MetricValues = {};
    const key = loincOf(o.code);
    if (key && key !== 'bloodPressure') setMetric(values, key, o.valueQuantity?.value, o.valueQuantity?.unit ?? o.valueQuantity?.code);
    for (const c of o.component ?? []) {
      const ck = loincOf(c.code);
      if (ck && ck !== 'bloodPressure') setMetric(values, ck, c.valueQuantity?.value, c.valueQuantity?.unit ?? c.valueQuantity?.code);
    }
    const observedAt = o.effectiveDateTime ? new Date(o.effectiveDateTime) : undefined;
    readings.push({ patientCode, values, observedAt: observedAt && !Number.isNaN(observedAt.getTime()) ? observedAt : undefined });
  }
  return merge(readings);
};

// ---- Generic JSON (device gateways, MQTT bridges): { patientCode, heartRate, ..., observedAt? } or { readings: [...] } ----
export const parseJson = (body: unknown): IncomingReading[] => {
  const root = body as { readings?: unknown } | null;
  const list = Array.isArray(root?.readings) ? (root!.readings as unknown[]) : [body];
  if (list.length === 0 || list.length > 100) throw new IngestParseError('Send between 1 and 100 readings per request');
  return merge(
    list.map((item) => {
      const r = (item ?? {}) as Record<string, unknown>;
      const patientCode = typeof r.patientCode === 'string' ? r.patientCode.trim() : '';
      if (!patientCode) throw new IngestParseError('Each reading needs a patientCode');
      const values: MetricValues = {};
      (['heartRate', 'systolicBP', 'diastolicBP', 'spO2', 'temperature', 'respiratoryRate'] as const).forEach((k) => setMetric(values, k, r[k]));
      const t = typeof r.observedAt === 'string' ? new Date(r.observedAt) : undefined;
      return { patientCode, values, observedAt: t && !Number.isNaN(t.getTime()) ? t : undefined };
    })
  );
};

export const ADAPTERS: Record<Protocol, (body: unknown) => IncomingReading[]> = { hl7: parseHl7, fhir: parseFhir, json: parseJson };
