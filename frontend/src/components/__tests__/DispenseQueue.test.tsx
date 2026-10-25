import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DispenseQueue } from '../Pharmacy/DispenseQueue';
import { apiGet, apiPost } from '../../services/api';
import { QueryWrapper } from '../../test/QueryWrapper';

vi.mock('../../services/api', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

const rx = (over = {}) => ({
  id: 'rx1', createdAt: '2026-01-02T10:00:00Z', prescriberName: 'Dr. Sara',
  patient: { id: 'p1', name: 'Ali Hassan', patientCode: 'PT-1' },
  items: [
    { id: 'i1', dose: '500 mg', frequency: 'twice daily', route: null, durationDays: 5, instructions: null, medication: { id: 'm1', name: 'Paracetamol', form: 'tablet', strength: '500 mg', active: true }, _count: { dispensations: 1 } },
    { id: 'i2', dose: '10 mg', frequency: 'daily', route: null, durationDays: 5, instructions: null, medication: { id: 'm2', name: 'Oldamine', form: 'tablet', strength: '10 mg', active: false }, _count: { dispensations: 0 } },
  ],
  ...over,
});

beforeEach(() => {
  vi.mocked(apiGet).mockReset();
  vi.mocked(apiPost).mockReset().mockResolvedValue({ success: true } as never);
});

describe('DispenseQueue', () => {
  it('lists waiting prescriptions with patient name + code only, and dispenses an item', async () => {
    vi.mocked(apiGet).mockResolvedValue({ success: true, data: [rx()] } as never);
    const user = userEvent.setup();
    render(<DispenseQueue />, { wrapper: QueryWrapper });
    expect(await screen.findByText('Ali Hassan')).toBeInTheDocument();
    expect(screen.getByText('(PT-1)')).toBeInTheDocument();
    expect(screen.getByText('Medication retired')).toBeInTheDocument(); // retired medication cannot be dispensed
    expect(screen.getAllByRole('button', { name: 'Dispense' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Dispense' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Dispense' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/pharmacy/dispense', { prescriptionItemId: 'i1', quantity: 1 }));
  });

  it('shows an empty state and sends the search to the server', async () => {
    vi.mocked(apiGet).mockResolvedValue({ success: true, data: [] } as never);
    const user = userEvent.setup();
    render(<DispenseQueue />, { wrapper: QueryWrapper });
    expect(await screen.findByText('No prescriptions are waiting.')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'ali');
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/pharmacy/queue', expect.objectContaining({ q: 'ali' })));
  });
});
