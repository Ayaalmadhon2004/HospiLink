import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsersPage } from '../UsersPage';
import { apiGet, apiPut } from '../../services/api';
import { QueryWrapper } from '../../test/QueryWrapper';
import { canAccessRoute } from '../../configs/permissions';

vi.mock('../../services/api', () => ({ apiGet: vi.fn(), apiPut: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/authContext', () => ({ useAuth: () => ({ user: { id: 'me', role: 'ADMIN' } }) }));

const u = (over: object) => ({ email: 'x@h.com', department: 'ICU', createdAt: '2026-01-01T00:00:00Z', ...over });
const users = [
  u({ id: 'me', name: 'Dana Admin', role: 'ADMIN', accountStatus: 'ACTIVE' }),
  u({ id: 'd1', name: 'Dr Sami', role: 'DOCTOR', accountStatus: 'ACTIVE' }),
  u({ id: 'p1', name: 'Newbie', role: 'DOCTOR', accountStatus: 'PENDING' }),
  u({ id: 'x1', name: 'Gone Guy', role: 'NURSE', accountStatus: 'DISABLED' }),
];

describe('UsersPage', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset().mockResolvedValue({ success: true, data: users } as never);
    vi.mocked(apiPut).mockReset().mockResolvedValue({ success: true } as never);
  });

  it('locks your own row: no role change, no deactivate', async () => {
    render(<UsersPage />, { wrapper: QueryWrapper });
    await screen.findByText('Dana Admin');
    expect(screen.getByLabelText('Role for Dana Admin')).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Deactivate' })).toHaveLength(1); // only Dr Sami
  });

  it('changing an active user\'s role asks for confirmation, then calls PUT /users/:id/role', async () => {
    const user = userEvent.setup();
    render(<UsersPage />, { wrapper: QueryWrapper });
    await screen.findByText('Dr Sami');
    await user.selectOptions(screen.getByLabelText('Role for Dr Sami'), 'NURSE');
    expect(apiPut).not.toHaveBeenCalled();
    const dialog = await screen.findByText(/signed out everywhere/i);
    expect(dialog).toHaveTextContent('from Doctor to Nurse');
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/users/d1/role', { role: 'NURSE' }));
  });

  it('approves a pending user with the role picked in the row', async () => {
    const user = userEvent.setup();
    render(<UsersPage />, { wrapper: QueryWrapper });
    const row = (await screen.findByText('Newbie')).closest('tr')!;
    await user.selectOptions(within(row).getByRole('combobox'), 'DISPATCHER');
    await user.click(within(row).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/users/p1/approve', { role: 'DISPATCHER' }));
  });

  it('activates a deactivated user with an explicit role, and deactivates an active one', async () => {
    const user = userEvent.setup();
    render(<UsersPage />, { wrapper: QueryWrapper });
    const gone = (await screen.findByText('Gone Guy')).closest('tr')!;
    await user.click(within(gone).getByRole('button', { name: 'Activate' }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/users/x1/activate', { role: 'NURSE' }));
    await user.click(within(screen.getByText('Dr Sami').closest('tr')!).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(apiPut).toHaveBeenCalledWith('/users/d1/deactivate'));
  });

  it('the status filter narrows the list', async () => {
    const user = userEvent.setup();
    render(<UsersPage />, { wrapper: QueryWrapper });
    await screen.findByText('Newbie');
    await user.click(screen.getByRole('button', { name: /^Pending/ }));
    expect(screen.getByText('Newbie')).toBeInTheDocument();
    expect(screen.queryByText('Dr Sami')).not.toBeInTheDocument();
  });

  it('is an ADMIN-only route', () => {
    expect(canAccessRoute('ADMIN', '/users')).toBe(true);
    expect(canAccessRoute('NURSE', '/users')).toBe(false);
  });
});
