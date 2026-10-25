import { flagFor, isCritical } from '../../src/services/labFlags';

describe('flagFor', () => {
  const lim = { refLow: 12, refHigh: 17, criticalLow: 7, criticalHigh: 20 };
  it.each([
    [14, 'NORMAL'], [12, 'NORMAL'], [17, 'NORMAL'], [11.9, 'LOW'], [17.1, 'HIGH'],
    [7, 'CRITICAL_LOW'], [3, 'CRITICAL_LOW'], [20, 'CRITICAL_HIGH'], [25, 'CRITICAL_HIGH'],
  ])('%s -> %s', (value, flag) => expect(flagFor(value, lim)).toBe(flag));

  it('no value or no limits -> no flag; half-open limits work', () => {
    expect(flagFor(undefined, lim)).toBeNull();
    expect(flagFor(5, {})).toBeNull();
    expect(flagFor(95, { refLow: 95 })).toBe('NORMAL');
    expect(flagFor(80, { refLow: 95 })).toBe('LOW');
  });
  it('isCritical', () => {
    expect(isCritical('CRITICAL_HIGH')).toBe(true);
    expect(isCritical('HIGH')).toBe(false);
    expect(isCritical(null)).toBe(false);
  });
});
