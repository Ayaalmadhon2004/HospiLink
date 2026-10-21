import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '../../i18n';
import { PatientFlowSection } from '../Dashboard/PatientFlowSection';
import { getPatients } from '../../services/patientService';

vi.mock('../../services/patientService', () => ({ getPatients: vi.fn() }));

// jsdom has no IntersectionObserver: report the chart as visible at once.
class VisibleObserver {
  constructor(private cb: (e: Array<{ isIntersecting: boolean }>) => void) {}
  observe() { this.cb([{ isIntersecting: true }]); }
  disconnect() {}
}

const PAGE_LIMIT = 50;

const renderSection = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PatientFlowSection />
    </QueryClientProvider>,
  );

describe('PatientFlowSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IntersectionObserver', VisibleObserver);
  });

  it('mounts the patient flow chart fed by the patients service', async () => {
    vi.mocked(getPatients).mockResolvedValue({ success: true, data: [] });
    renderSection();
    expect(await screen.findByText('Patient Flow')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Patient flow over the last 7 days' })).toBeInTheDocument();
    expect(getPatients).toHaveBeenCalledWith({ limit: PAGE_LIMIT });
  });

  it('shows a retryable alert when loading fails, in Arabic too', async () => {
    await i18n.changeLanguage('ar');
    vi.mocked(getPatients).mockRejectedValue(new Error('boom'));
    renderSection();
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّر تحميل حركة المرضى.');
    expect(screen.getByRole('button', { name: 'إعادة تحميل حركة المرضى' })).toBeInTheDocument();
  });
});
