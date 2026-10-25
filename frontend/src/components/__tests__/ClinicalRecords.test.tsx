import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClinicalRecords } from '../Clinical/ClinicalRecords';
import { PrescriptionModal } from '../Clinical/PrescriptionModal';
import { LabResultsModal } from '../Clinical/LabResultsModal';
import { apiGet, apiPost, apiPut } from '../../services/api';
import { submitLabResults } from '../../services/clinicalService';
import { QueryWrapper } from '../../test/QueryWrapper';
import { hasPermission } from '../../configs/permissions';
import type { LabOrder } from '../../types/clinical';

vi.mock('../../services/api', () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPut: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const useAuth = vi.fn();
vi.mock('../../contexts/authContext', () => ({ useAuth: () => useAuth() }));

const note = (over = {}) => ({ id: 'n1', patientId: 'p1', type: 'PROGRESS', content: 'Stable overnight', authorName: 'Dr Who', supersedesId: null, createdAt: '2026-01-02T10:00:00Z', ...over });
const rx = { id: 'rx1', status: 'ACTIVE', notes: null, prescriberName: 'Dr Who', createdAt: '2026-01-02T10:00:00Z', items: [{ id: 'i1', dose: '1 tab', frequency: 'TID', route: 'oral', durationDays: 5, instructions: null, medication: { id: 'm1', name: 'Paracetamol', form: 'tablet', strength: '500 mg' } }] };
const lab = (over = {}): LabOrder => ({ id: 'l1', testName: 'CBC', testCode: null, priority: 'ROUTINE', status: 'ORDERED', notes: null, orderedByName: 'Dr Who', orderedAt: '2026-01-02T10:00:00Z', resultedAt: null, results: [], ...over });

const data: Record<string, unknown[]> = { '/clinical-notes': [note()], '/prescriptions': [rx], '/lab-orders': [lab()], '/medications': [{ id: 'm1', name: 'Paracetamol', genericName: null, form: 'tablet', strength: '500 mg', active: true }] };

beforeEach(() => {
  vi.mocked(apiGet).mockReset().mockImplementation((async (url: string) => ({ success: true, data: data[url] ?? [] })) as never);
  vi.mocked(apiPost).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(apiPut).mockReset().mockResolvedValue({ success: true } as never);
  data['/clinical-notes'] = [note()];
  data['/lab-orders'] = [lab()];
});

const renderAs = (role: string) => {
  useAuth.mockReturnValue({ user: { id: 'u1', role } });
  return render(<ClinicalRecords patientId="p1" />, { wrapper: QueryWrapper });
};

describe('clinical permissions', () => {
  it('mirror the backend matrix', () => {
    expect(hasPermission('DISPATCHER', 'clinical:read')).toBe(false);
    expect(hasPermission('NURSE', 'rx:write')).toBe(false);
    expect(hasPermission('NURSE', 'labs:result')).toBe(true);
    expect(hasPermission('ADMIN', 'labs:result')).toBe(false);
    expect(hasPermission('ADMIN', 'medications:manage')).toBe(true);
  });
});

describe('notes tab', () => {
  it('a DOCTOR can add and amend; an amendment is posted to /amend, never a PUT', async () => {
    const user = userEvent.setup();
    renderAs('DOCTOR');
    expect(await screen.findByText('Stable overnight')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Amend' }));
    const box = within(await screen.findByRole('dialog')).getByRole('textbox');
    await user.clear(box);
    await user.type(box, 'Improving');
    await user.click(screen.getByRole('button', { name: 'Save amendment' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/clinical-notes/n1/amend', { content: 'Improving' }));
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('a NURSE can add notes but cannot amend a doctor\'s note; ADMIN is read-only', async () => {
    const { unmount } = renderAs('NURSE');
    await screen.findByText('Stable overnight');
    expect(screen.getByRole('button', { name: 'Add note' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Amend' })).not.toBeInTheDocument();
    unmount();
    renderAs('ADMIN');
    await screen.findByText('Stable overnight');
    expect(screen.queryByRole('button', { name: 'Add note' })).not.toBeInTheDocument();
  });

  it('a nurse amends her own NURSING note, and an amended note shows a badge + history', async () => {
    data['/clinical-notes'] = [note({ type: 'NURSING', supersedesId: 'n0' })];
    vi.mocked(apiGet).mockImplementation((async (url: string) =>
      url.endsWith('/history') ? { success: true, data: [note({ id: 'n1' }), note({ id: 'n0', content: 'Old wording' })] } : { success: true, data: data[url] ?? [] }) as never);
    const user = userEvent.setup();
    renderAs('NURSE');
    expect(await screen.findByText('Amended')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Amend' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Earlier versions' }));
    expect(await screen.findByText('Old wording')).toBeInTheDocument();
  });
});

describe('prescriptions tab', () => {
  it('a DOCTOR sees items and can complete or cancel an active prescription', async () => {
    const user = userEvent.setup();
    renderAs('DOCTOR');
    await user.click(screen.getByRole('tab', { name: 'Prescriptions' }));
    expect(await screen.findByText(/Paracetamol 500 mg/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Mark completed' }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/prescriptions/rx1/status', { status: 'COMPLETED' }));
  });

  it('a NURSE can read but not prescribe or close', async () => {
    const user = userEvent.setup();
    renderAs('NURSE');
    await user.click(screen.getByRole('tab', { name: 'Prescriptions' }));
    await screen.findByText(/Paracetamol 500 mg/);
    expect(screen.queryByRole('button', { name: 'New prescription' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark completed' })).not.toBeInTheDocument();
  });

  it('PrescriptionModal posts items for the chosen medication and blocks an incomplete item', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<PrescriptionModal patientId="p1" onClose={vi.fn()} onSaved={onSaved} />, { wrapper: QueryWrapper });
    const save = screen.getByRole('button', { name: 'Save prescription' });
    expect(save).toBeDisabled();
    await screen.findByRole('option', { name: /Paracetamol/ });
    await user.selectOptions(screen.getByLabelText('Medication'), 'm1');
    await user.type(screen.getByLabelText('Dose'), '1 tab');
    await user.type(screen.getByLabelText('Frequency'), 'TID');
    await user.type(screen.getByLabelText('Days'), '5');
    await user.click(save);
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/prescriptions', {
      patientId: 'p1', notes: undefined,
      items: [{ medicationId: 'm1', dose: '1 tab', frequency: 'TID', route: undefined, instructions: undefined, durationDays: 5 }],
    }));
    expect(onSaved).toHaveBeenCalled();
  });
});

describe('labs tab', () => {
  it('shows flagged results with the critical ones marked', async () => {
    data['/lab-orders'] = [lab({ status: 'RESULTED', results: [
      { id: 'r1', analyte: 'Hb', value: 5, textValue: null, unit: 'g/dL', refLow: 12, refHigh: 17, flag: 'CRITICAL_LOW' },
      { id: 'r2', analyte: 'WBC', value: 8, textValue: null, unit: null, refLow: 4, refHigh: 11, flag: 'NORMAL' },
    ] })];
    const user = userEvent.setup();
    renderAs('DOCTOR');
    await user.click(screen.getByRole('tab', { name: 'Lab results' }));
    const crit = await screen.findByText('Critical low');
    expect(crit.className).toMatch(/red/);
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enter results' })).not.toBeInTheDocument(); // already resulted
  });

  it('role gating on a pending order: DOCTOR enters/cancels, NURSE only enters, ADMIN neither', async () => {
    const user = userEvent.setup();
    const { unmount } = renderAs('NURSE');
    await user.click(screen.getByRole('tab', { name: 'Lab results' }));
    await screen.findByText('CBC');
    expect(screen.getByRole('button', { name: 'Enter results' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Order lab test' })).not.toBeInTheDocument();
    unmount();
    renderAs('ADMIN');
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Lab results' }));
    await screen.findByText('CBC');
    expect(screen.queryByRole('button', { name: 'Enter results' })).not.toBeInTheDocument();
  });

  it('cancelling an order calls PUT /lab-orders/:id/cancel', async () => {
    const user = userEvent.setup();
    renderAs('DOCTOR');
    await user.click(screen.getByRole('tab', { name: 'Lab results' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel order' }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/lab-orders/l1/cancel'));
  });

  it('LabResultsModal sends numbers as numbers, text as textValue and omits blank limits', async () => {
    const user = userEvent.setup();
    render(<LabResultsModal order={lab()} onClose={vi.fn()} onSaved={vi.fn()} />);
    const dlg = screen.getByRole('dialog');
    await user.type(within(dlg).getByLabelText('Value'), '5.5');
    await user.type(within(dlg).getByLabelText('Normal from'), '12');
    await user.type(within(dlg).getByLabelText('Critical below'), '7');
    await user.click(within(dlg).getByRole('button', { name: 'Save results' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    const [url, payload] = vi.mocked(apiPost).mock.calls[0] as [string, { results: Record<string, unknown>[] }];
    expect(url).toBe('/lab-orders/l1/results');
    expect(payload.results[0]).toMatchObject({ analyte: 'CBC', value: 5.5, refLow: 12, criticalLow: 7, refHigh: undefined });
  });

  it('submitLabResults maps a non-numeric value to textValue', async () => {
    await submitLabResults('l1', [{ analyte: 'Culture', value: 'No growth', unit: '', refLow: '', refHigh: '', criticalLow: '', criticalHigh: '' }]);
    const payload = vi.mocked(apiPost).mock.calls[0][1] as { results: Record<string, unknown>[] };
    expect(payload.results[0]).toMatchObject({ analyte: 'Culture', textValue: 'No growth' });
    expect(payload.results[0]).not.toHaveProperty('value');
  });
});
