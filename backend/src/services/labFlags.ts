// backend/src/services/labFlags.ts
import type { LabFlag } from '@prisma/client';

export interface LabLimits {
  refLow?: number | null;
  refHigh?: number | null;
  criticalLow?: number | null;
  criticalHigh?: number | null;
}

/** Judges a numeric result against its limits. Critical limits win; no value or no limits at all -> no flag. */
export const flagFor = (value: number | null | undefined, l: LabLimits): LabFlag | null => {
  if (typeof value !== 'number') return null;
  if (typeof l.criticalLow === 'number' && value <= l.criticalLow) return 'CRITICAL_LOW';
  if (typeof l.criticalHigh === 'number' && value >= l.criticalHigh) return 'CRITICAL_HIGH';
  if (typeof l.refLow === 'number' && value < l.refLow) return 'LOW';
  if (typeof l.refHigh === 'number' && value > l.refHigh) return 'HIGH';
  const hasLimits = [l.refLow, l.refHigh, l.criticalLow, l.criticalHigh].some((x) => typeof x === 'number');
  return hasLimits ? 'NORMAL' : null;
};

export const isCritical = (f: LabFlag | null): boolean => f === 'CRITICAL_LOW' || f === 'CRITICAL_HIGH';
