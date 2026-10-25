import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WardsPanel } from '../Wards/WardsPanel';
import { WardModal } from '../Wards/WardModal';
import { apiGet, apiPost, apiPut, apiDelete } from '../../services/api';
import { QueryWrapper } from '../../test/QueryWrapper';

vi.mock('../../services/api', () => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiPut: vi.fn(), apiDelete: vi.fn() }));
const useAuth = vi.fn();
vi.mock('../../contexts/authContext', () => ({ useAuth: () => useAuth() }));

const wards = [
  { id: 'w1', name: 'ICU', floor: 2, _count: { beds: 3 } },
  { id: 'w2', name: 'Annex', floor: null, _count: { beds: 0 } },
];

describe('WardsPanel', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset().mockResolvedValue({ success: true, data: wards } as never);
    vi.mocked(apiDelete).mockReset().mockResolvedValue({ success: true } as never);
  });

  it('an ADMIN can add, edit and delete; a ward with beds cannot be deleted', async () => {
    useAuth.mockReturnValue({ user: { role: 'ADMIN' } });
    render(<WardsPanel />, { wrapper: QueryWrapper });
    expect(await screen.findByText('ICU')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Ward' })).toBeInTheDocument();
    expect(screen.getByText('Floor 2 · 3 beds')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete ward ICU' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit ward ICU' })).toBeEnabled();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete ward Annex' }));
    await userEvent.setup().click(await screen.findByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/wards/w2'));
  });

  it.each(['NURSE', 'DOCTOR', 'DISPATCHER'])('a %s sees the wards but no management buttons', async (role) => {
    useAuth.mockReturnValue({ user: { role } });
    render(<WardsPanel />, { wrapper: QueryWrapper });
    expect(await screen.findByText('ICU')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Ward' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit ward/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete ward/ })).not.toBeInTheDocument();
  });
});

describe('WardModal', () => {
  beforeEach(() => {
    vi.mocked(apiPost).mockReset().mockResolvedValue({ success: true } as never);
    vi.mocked(apiPut).mockReset().mockResolvedValue({ success: true } as never);
  });

  it('creates a ward with a numeric floor', async () => {
    const onSuccess = vi.fn();
    render(<WardModal isOpen ward={null} onClose={vi.fn()} onSuccess={onSuccess} />, { wrapper: QueryWrapper });
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/cardiology/i), '  Cardiology ');
    await user.type(screen.getByPlaceholderText(/e.g. 2/i), '4');
    await user.click(screen.getByRole('button', { name: 'Add Ward' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/wards', { name: 'Cardiology', floor: 4 }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('editing and emptying the floor sends floor: null', async () => {
    render(<WardModal isOpen ward={{ id: 'w1', name: 'ICU', floor: 2 }} onClose={vi.fn()} onSuccess={vi.fn()} />, { wrapper: QueryWrapper });
    const user = userEvent.setup();
    await user.clear(screen.getByPlaceholderText(/e.g. 2/i));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/wards/w1', { name: 'ICU', floor: null }));
  });
});
