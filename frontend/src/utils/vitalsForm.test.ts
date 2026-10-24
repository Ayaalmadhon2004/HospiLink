import { describe, it, expect } from 'vitest';
import { EMPTY_FORM, toReading } from './vitalsForm';

describe('toReading', () => {
  it('sends only the measured metrics, as numbers', () => {
    expect(toReading({ ...EMPTY_FORM, heartRate: '72', spO2: '97.5', temperature: '36.6', notes: 'calm' })).toEqual({
      heartRate: 72,
      spO2: 97.5,
      temperature: 36.6,
      notes: 'calm',
    });
  });

  it('sends an empty reading for an empty form and keeps a measured zero', () => {
    expect(toReading(EMPTY_FORM)).toEqual({});
    expect(toReading({ ...EMPTY_FORM, respiratoryRate: '0' })).toEqual({ respiratoryRate: 0 });
  });
});
