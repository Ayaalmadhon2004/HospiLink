import { describe, it, expect } from 'vitest';
import { buildPatientFlow } from './patientFlow';

// Local-time strings (no "Z") so day buckets match the machine's timezone.
const NOW = new Date('2026-10-21T12:00:00');
const LABELS = { admissions: 'In', discharges: 'Out' };
const WEEK = 7;
const SHORT = 3;
const TWO = 2;

describe('buildPatientFlow', () => {
  it('buckets admissions and discharges per day over the window', () => {
    const flow = buildPatientFlow(
      [
        { admissionDate: '2026-10-21T08:00:00' },
        { admissionDate: '2026-10-21T09:00:00', dischargeDate: '2026-10-20T09:00:00' },
        { admissionDate: '2026-10-15T09:00:00' },
        { admissionDate: '2026-09-01T08:00:00' },
      ],
      LABELS,
      'en',
      WEEK,
      NOW,
    );
    expect(flow.labels).toHaveLength(WEEK);
    expect(flow.datasets.map((d) => d.label)).toEqual(['In', 'Out']);
    expect(flow.datasets[0].data).toEqual([1, 0, 0, 0, 0, 0, TWO]);
    expect(flow.datasets[1].data).toEqual([0, 0, 0, 0, 0, 1, 0]);
  });

  it('returns zeros for an empty list', () => {
    const flow = buildPatientFlow([], LABELS, 'en', SHORT, NOW);
    expect(flow.datasets[0].data).toEqual([0, 0, 0]);
  });
});
