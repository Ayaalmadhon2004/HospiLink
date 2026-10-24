// backend/src/services/vitalThresholds.ts
import prisma from '../config/db';
import logger from '../config/logger';

export const VITAL_TYPES = ['HEART_RATE', 'BP_SYSTOLIC', 'BP_DIASTOLIC', 'SPO2', 'TEMPERATURE', 'RESPIRATORY_RATE'] as const;
export type VitalType = (typeof VITAL_TYPES)[number];

export interface ThresholdRule {
  vitalType: VitalType;
  minNormal: number | null;
  maxNormal: number | null;
  minCritical: number | null;
  maxCritical: number | null;
  alertEnabled: boolean;
  autoNotify: boolean;
}

export interface EffectiveThreshold extends ThresholdRule {
  /** 'custom' = a row of this hospital + department; 'default' = the built-in adult range below. */
  source: 'custom' | 'default';
  id: string | null;
}

// Adult reference ranges (temperature in °C). Used for every (department, vitalType) the hospital has not configured,
// so a department without rows still raises alerts instead of silently never alerting.
export const DEFAULT_THRESHOLDS: ThresholdRule[] = [
  { vitalType: 'HEART_RATE', minNormal: 60, maxNormal: 100, minCritical: 40, maxCritical: 130, alertEnabled: true, autoNotify: false },
  { vitalType: 'BP_SYSTOLIC', minNormal: 90, maxNormal: 140, minCritical: 80, maxCritical: 180, alertEnabled: true, autoNotify: false },
  { vitalType: 'BP_DIASTOLIC', minNormal: 60, maxNormal: 90, minCritical: 40, maxCritical: 120, alertEnabled: true, autoNotify: false },
  { vitalType: 'SPO2', minNormal: 95, maxNormal: null, minCritical: 90, maxCritical: null, alertEnabled: true, autoNotify: false },
  { vitalType: 'TEMPERATURE', minNormal: 36.1, maxNormal: 37.8, minCritical: 35, maxCritical: 40, alertEnabled: true, autoNotify: false },
  { vitalType: 'RESPIRATORY_RATE', minNormal: 12, maxNormal: 20, minCritical: 8, maxCritical: 30, alertEnabled: true, autoNotify: false },
];

const defaults = (): EffectiveThreshold[] => DEFAULT_THRESHOLDS.map((d) => ({ ...d, source: 'default', id: null }));

/**
 * The thresholds that apply to a department of a hospital: its own rows, completed with the defaults for the vital
 * types it has no row for. If the database cannot be read, the defaults are used and the failure is logged as an
 * error: a reading must never be judged "not critical" just because the lookup failed.
 */
export const loadEffectiveThresholds = async (hospitalId: string, department: string): Promise<EffectiveThreshold[]> => {
  try {
    const rows = await prisma.vitalThresholds.findMany({ where: { hospitalId, department } });
    const byType = new Map(rows.map((r) => [r.vitalType, r]));
    return VITAL_TYPES.map((vitalType): EffectiveThreshold => {
      const row = byType.get(vitalType);
      if (!row) return { ...DEFAULT_THRESHOLDS.find((d) => d.vitalType === vitalType)!, source: 'default', id: null };
      return {
        vitalType,
        minNormal: row.minNormal,
        maxNormal: row.maxNormal,
        minCritical: row.minCritical,
        maxCritical: row.maxCritical,
        alertEnabled: row.alertEnabled,
        autoNotify: row.autoNotify,
        source: 'custom',
        id: row.id,
      };
    });
  } catch (err) {
    logger.error({ err, hospitalId, department }, 'Could not load vital thresholds; using the built-in defaults');
    return defaults();
  }
};

type Reading = Partial<Record<'heartRate' | 'systolicBP' | 'diastolicBP' | 'spO2' | 'temperature' | 'respiratoryRate', number | null>>;

const readingFor = (type: VitalType, v: Reading): number | null | undefined =>
  ({
    HEART_RATE: v.heartRate,
    BP_SYSTOLIC: v.systolicBP,
    BP_DIASTOLIC: v.diastolicBP,
    SPO2: v.spO2,
    TEMPERATURE: v.temperature,
    RESPIRATORY_RATE: v.respiratoryRate,
  })[type];

// The API accepts a temperature in °C or °F (up to 120). No living patient is at 50 °C, and none at 50 °F,
// so above 50 it is Fahrenheit. Only the built-in defaults assume °C; a hospital's own rows are compared as typed.
const toCelsius = (value: number): number => (value > 50 ? ((value - 32) * 5) / 9 : value);

/** First breached critical limit (in VITAL_TYPES order), or not critical. Missing/invalid metrics are skipped. */
export const evaluateReading = (
  vitals: Reading,
  thresholds: EffectiveThreshold[],
): { isCritical: boolean; alertType: string | null } => {
  for (const type of VITAL_TYPES) {
    const t = thresholds.find((x) => x.vitalType === type);
    if (!t || !t.alertEnabled) continue;
    const raw = readingFor(type, vitals);
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    const value = type === 'TEMPERATURE' && t.source === 'default' ? toCelsius(raw) : raw;
    if (t.minCritical !== null && value < t.minCritical) return { isCritical: true, alertType: `${type}_LOW` };
    if (t.maxCritical !== null && value > t.maxCritical) return { isCritical: true, alertType: `${type}_HIGH` };
  }
  return { isCritical: false, alertType: null };
};
