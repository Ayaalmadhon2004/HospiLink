// backend/src/services/vitalsParsing.ts
// Pure parsing helpers for manually entered vitals (extracted from vitals.controller).

export const METRIC_KEYS = [
  'heartRate',
  'systolicBP',
  'diastolicBP',
  'spO2',
  'temperature',
  'respiratoryRate',
] as const;
export type MetricValues = Partial<Record<(typeof METRIC_KEYS)[number], number | null>>;

// undefined/null/'' => null (missing); numeric value/string => finite number; anything else => undefined (invalid).
export const parseMetric = (v: unknown): number | null | undefined => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  return undefined;
};

// Reads the metric keys of `body`. Never yields NaN: bad values are listed in `invalid`.
export const parseMetrics = (body: Record<string, unknown>, onlyPresent = false) => {
  const values: MetricValues = {};
  const invalid: string[] = [];
  for (const key of METRIC_KEYS) {
    if (onlyPresent && !(key in body)) continue;
    const parsed = parseMetric(body[key]);
    if (parsed === undefined) invalid.push(key);
    else values[key] = parsed;
  }
  return { values, invalid };
};

// The metrics a stored reading will have after an edit: new values win, the rest keep the stored ones (non-finite -> null).
export const mergeMetrics = (values: MetricValues, current: MetricValues): MetricValues => {
  const merged: MetricValues = {};
  for (const key of METRIC_KEYS) {
    const next = key in values ? values[key] : current[key];
    merged[key] = typeof next === 'number' && Number.isFinite(next) ? next : null;
  }
  return merged;
};
