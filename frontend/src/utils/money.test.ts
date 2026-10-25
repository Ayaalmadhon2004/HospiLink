import { describe, it, expect } from 'vitest';
import { parseMajorToMinor, formatMoney } from './money';

describe('money', () => {
  it.each([['12.5', 1250], ['12,50', 1250], ['0', 0], ['7', 700], [' 3.05 ', 305], ['0.1', 10]])('parses %s -> %d', (input, minor) => {
    expect(parseMajorToMinor(input)).toBe(minor);
  });
  it.each([[''], ['-1'], ['1.234'], ['abc'], ['1.2.3'], ['1e3']])('rejects %j', (input) => {
    expect(parseMajorToMinor(input)).toBeNull();
  });
  it('formats minor units with the currency', () => {
    expect(formatMoney(123456, 'USD')).toMatch(/1,234\.56/);
    expect(formatMoney(5, 'XXXNOTACODE')).toBe('0.05 XXXNOTACODE');
  });
});
