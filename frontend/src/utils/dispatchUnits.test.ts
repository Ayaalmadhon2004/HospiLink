import { describe, it, expect } from 'vitest';
import { computeUnitStats, getUnitAlarm, type DispatchUnit } from './dispatchUnits';

const NOW = Date.parse('2026-01-01T12:00:00Z');
const MIN = 60_000;
const ago = (m: number) => new Date(NOW - m * MIN).toISOString();
const unit = (o: Partial<DispatchUnit>): DispatchUnit => ({ id: 'u', unitCode: 'A1', unitType: 'AMBULANCE', status: 'AVAILABLE', crew: [], ...o });

describe('getUnitAlarm', () => {
  it('flags critical active missions', () => {
    const call = { id: 'c', type: 'MVA', location: 'X', priority: 'CRITICAL' as const };
    expect(getUnitAlarm(unit({ status: 'EN_ROUTE', currentCall: call, lastUpdated: ago(1) }), NOW)).toBe('critical');
  });
  it('flags prolonged on-scene and delayed units', () => {
    expect(getUnitAlarm(unit({ status: 'ON_SCENE', lastUpdated: ago(45) }), NOW)).toBe('prolongedOnScene');
    expect(getUnitAlarm(unit({ status: 'EN_ROUTE', eta: 5, lastUpdated: ago(20) }), NOW)).toBe('delayed');
  });
  it('ignores available / off-duty / fresh units', () => {
    expect(getUnitAlarm(unit({ status: 'AVAILABLE', lastUpdated: ago(500) }), NOW)).toBeNull();
    expect(getUnitAlarm(unit({ status: 'ON_SCENE', lastUpdated: ago(5) }), NOW)).toBeNull();
  });
});

describe('computeUnitStats', () => {
  it('derives KPIs from the units array', () => {
    const units = [unit({ status: 'AVAILABLE' }), unit({ status: 'EN_ROUTE' }), unit({ status: 'ON_SCENE', lastUpdated: ago(60) }), unit({ status: 'OFF_DUTY' })];
    expect(computeUnitStats(units, NOW)).toEqual({ active: 3, available: 1, enRoute: 1, onScene: 1, alarms: 1 });
  });
});
