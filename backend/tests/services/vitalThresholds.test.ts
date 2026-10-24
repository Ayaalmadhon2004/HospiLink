import { prismaMock } from '../mocks/prisma';
import logger from '../../src/config/logger';
import { DEFAULT_THRESHOLDS, VITAL_TYPES, evaluateReading, loadEffectiveThresholds, type EffectiveThreshold } from '../../src/services/vitalThresholds';

const defaults = (): EffectiveThreshold[] => DEFAULT_THRESHOLDS.map((d) => ({ ...d, source: 'default' as const, id: null }));

describe('vitalThresholds service', () => {
  it('has a default for every vital type', () => {
    expect(DEFAULT_THRESHOLDS.map((d) => d.vitalType).sort()).toEqual([...VITAL_TYPES].sort());
  });

  describe('evaluateReading', () => {
    it.each([
      [{ heartRate: 39 }, 'HEART_RATE_LOW'],
      [{ heartRate: 131 }, 'HEART_RATE_HIGH'],
      [{ systolicBP: 79 }, 'BP_SYSTOLIC_LOW'],
      [{ systolicBP: 181 }, 'BP_SYSTOLIC_HIGH'],
      [{ diastolicBP: 121 }, 'BP_DIASTOLIC_HIGH'],
      [{ spO2: 89 }, 'SPO2_LOW'],
      [{ temperature: 34.9 }, 'TEMPERATURE_LOW'],
      [{ temperature: 40.1 }, 'TEMPERATURE_HIGH'],
      [{ respiratoryRate: 31 }, 'RESPIRATORY_RATE_HIGH'],
    ])('default limits: %j -> %s', (reading, alertType) => {
      expect(evaluateReading(reading, defaults())).toEqual({ isCritical: true, alertType });
    });

    it('values on the limit and normal values are not critical; missing metrics are skipped', () => {
      expect(evaluateReading({ heartRate: 40, systolicBP: 80, spO2: 90, temperature: 40, respiratoryRate: 30 }, defaults()).isCritical).toBe(false);
      expect(evaluateReading({ heartRate: 75, spO2: 98, temperature: 37 }, defaults()).isCritical).toBe(false);
      expect(evaluateReading({ heartRate: null, spO2: Number.NaN }, defaults())).toEqual({ isCritical: false, alertType: null });
    });

    it('temperature above 50 is read as °F for the default rules only', () => {
      expect(evaluateReading({ temperature: 104 }, defaults()).isCritical).toBe(false); // 40 °C
      expect(evaluateReading({ temperature: 107 }, defaults())).toEqual({ isCritical: true, alertType: 'TEMPERATURE_HIGH' });
      const custom: EffectiveThreshold[] = defaults().map((t) =>
        t.vitalType === 'TEMPERATURE' ? { ...t, source: 'custom' as const, maxCritical: 104 } : t
      );
      expect(evaluateReading({ temperature: 105 }, custom)).toEqual({ isCritical: true, alertType: 'TEMPERATURE_HIGH' }); // as typed
    });

    it('a disabled rule never alerts', () => {
      const off = defaults().map((t) => (t.vitalType === 'SPO2' ? { ...t, alertEnabled: false } : t));
      expect(evaluateReading({ spO2: 50 }, off).isCritical).toBe(false);
    });
  });

  describe('loadEffectiveThresholds', () => {
    it('queries by hospital AND department and fills missing vital types with defaults', async () => {
      prismaMock.vitalThresholds.findMany.mockResolvedValue([
        { id: 't1', vitalType: 'SPO2', minNormal: 94, maxNormal: null, minCritical: 85, maxCritical: null, alertEnabled: true, autoNotify: true },
      ] as any);

      const rules = await loadEffectiveThresholds('h1', 'ICU');

      expect(prismaMock.vitalThresholds.findMany).toHaveBeenCalledWith({ where: { hospitalId: 'h1', department: 'ICU' } });
      expect(rules).toHaveLength(6);
      expect(rules.find((r) => r.vitalType === 'SPO2')).toMatchObject({ source: 'custom', id: 't1', minCritical: 85, autoNotify: true });
      expect(rules.filter((r) => r.source === 'default')).toHaveLength(5);
    });

    it('a failing lookup is logged as an error and falls back to the defaults', async () => {
      const error = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
      prismaMock.vitalThresholds.findMany.mockRejectedValue(new Error('db down'));

      const rules = await loadEffectiveThresholds('h1', 'ICU');

      expect(error).toHaveBeenCalled();
      expect(rules.every((r) => r.source === 'default')).toBe(true);
      error.mockRestore();
    });
  });
});
