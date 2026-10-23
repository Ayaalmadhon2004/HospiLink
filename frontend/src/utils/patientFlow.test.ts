import { describe, it, expect } from 'vitest';
import { buildPatientFlow } from './patientFlow';

const LABELS = { admissions: 'In', discharges: 'Out' };

describe('buildPatientFlow', () => {
  it('maps the daily counts to one dataset each, keeping the order', () => {
    const flow = buildPatientFlow(
      [
        { date: '2026-10-20', admissions: 2, discharges: 0 },
        { date: '2026-10-21', admissions: 1, discharges: 3 },
      ],
      LABELS,
      'en',
    );
    expect(flow.labels).toHaveLength(2);
    expect(flow.datasets.map((d) => d.label)).toEqual(['In', 'Out']);
    expect(flow.datasets[0].data).toEqual([2, 1]);
    expect(flow.datasets[1].data).toEqual([0, 3]);
  });

  it('labels days by their UTC date whatever the machine timezone', () => {
    const flow = buildPatientFlow([{ date: '2026-10-21', admissions: 0, discharges: 0 }], LABELS, 'en');
    expect(flow.labels[0]).toContain('21');
  });

  it('returns empty series for no data', () => {
    const flow = buildPatientFlow([], LABELS, 'en');
    expect(flow.labels).toEqual([]);
    expect(flow.datasets[0].data).toEqual([]);
  });
});
