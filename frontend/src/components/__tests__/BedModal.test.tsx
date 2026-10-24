import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BedModal } from '../BedModal';
import { apiGet, apiPut } from '../../services/api';
import type { BedWithDetails } from '../../types/bed';

vi.mock('../../services/api', () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPut: vi.fn() }));

const patients = [{ id: 'p1', name: 'Ali Hassan', patientCode: 'PT-7' }, { id: 'p2', name: 'Sara Omar', patientCode: 'PT-8' }];
const bed = (over: Partial<BedWithDetails> = {}): BedWithDetails => ({
  id: 'b1', bedNumber: 'A1', status: 'AVAILABLE', wardId: 'w1', patientId: null, createdAt: '', updatedAt: '', ward: { name: 'ICU' }, patient: null, ...over,
});

const renderModal = (b: BedWithDetails) => render(<BedModal bed={b} patients={patients} onClose={vi.fn()} onSuccess={vi.fn()} />);
const submit = () => userEvent.setup().click(screen.getByRole('button', { name: /save|update/i }));

describe('BedModal keeps OCCUPIED <=> has a patient', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset().mockResolvedValue({ success: true, data: [{ id: 'w1', name: 'ICU' }] } as never);
    vi.mocked(apiPut).mockReset().mockResolvedValue({ success: true } as never);
  });

  it('assigning a patient sends patientId and OCCUPIED', async () => {
    const user = userEvent.setup();
    renderModal(bed());
    await user.click(screen.getByRole('combobox', { name: /assign patient/i }));
    await user.click(await screen.findByRole('option', { name: /Ali Hassan/ }));
    await submit();

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1));
    expect(vi.mocked(apiPut).mock.calls[0][1]).toMatchObject({ patientId: 'p1', status: 'OCCUPIED' });
  });

  it('clearing the patient of an occupied bed sends an explicit unassign and AVAILABLE', async () => {
    const user = userEvent.setup();
    renderModal(bed({ status: 'OCCUPIED', patientId: 'p1', patient: { id: 'p1', name: 'Ali Hassan' } }));
    await user.click(screen.getByRole('combobox', { name: /assign patient/i }));
    await user.click(await screen.findByRole('option', { name: /unassigned/i }));
    await submit();

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1));
    expect(vi.mocked(apiPut).mock.calls[0][1]).toMatchObject({ patientId: '', status: 'AVAILABLE' });
  });

  it('editing a CLEANING bed without a patient no longer silently turns it AVAILABLE', async () => {
    renderModal(bed({ status: 'CLEANING' }));
    await submit();

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1));
    const body = vi.mocked(apiPut).mock.calls[0][1] as Record<string, string>;
    expect(body.status).toBe('CLEANING');
    expect(body).not.toHaveProperty('patientId');
  });
});
