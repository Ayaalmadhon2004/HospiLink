import { describe, it, expect } from 'vitest';
import { dayStartIso, nextDayStartIso, toDayValue, lastIncludedDayValue } from './dateRange';

describe('dateRange', () => {
  it('"to" is exclusive: the end of Jan 31 is the start of Feb 1 (local midnight)', () => {
    expect(nextDayStartIso('2026-01-31')).toBe(new Date(2026, 1, 1).toISOString());
    expect(dayStartIso('2026-01-31')).toBe(new Date(2026, 0, 31).toISOString());
  });
  it('round-trips the picker value', () => {
    expect(toDayValue(dayStartIso('2026-03-09'))).toBe('2026-03-09');
    expect(lastIncludedDayValue(nextDayStartIso('2026-03-09'))).toBe('2026-03-09');
    expect(toDayValue(undefined)).toBe('');
    expect(lastIncludedDayValue(undefined)).toBe('');
  });
});
