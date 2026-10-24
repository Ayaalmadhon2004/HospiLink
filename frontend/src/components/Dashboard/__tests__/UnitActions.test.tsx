import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UnitActions from '../UnitActions';
import { apiPost } from '../../../services/api';

vi.mock('../../../services/api', () => ({ apiGet: vi.fn().mockResolvedValue({ data: [] }), apiPost: vi.fn(), apiPut: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const call = { id: 'c1', type: 'Cardiac arrest', location: 'Gate 2', priority: 'HIGH' as const };

const renderActions = (unit: Parameters<typeof UnitActions>[0]['unit']) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <UnitActions unit={unit} />
    </QueryClientProvider>,
  );

describe('UnitActions', () => {
  beforeEach(() => vi.mocked(apiPost).mockReset().mockResolvedValue({}));

  it('a unit on a call can complete or cancel it, and cannot be freed by hand', async () => {
    renderActions({ id: 'u1', unitCode: 'AMB-1', unitType: 'AMBULANCE', status: 'EN_ROUTE', crew: [], currentCall: call });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /AMB-1/ }));
    expect(screen.getByRole('menuitem', { name: 'Complete call' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cancel call' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'TRANSPORTING' })).toBeInTheDocument(); // other statuses stay
    expect(screen.queryByRole('menuitem', { name: 'AVAILABLE' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'OFF DUTY' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Complete call' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/dispatch/calls/c1/complete'));
  });

  it('cancel calls the cancel endpoint', async () => {
    renderActions({ id: 'u1', unitCode: 'AMB-1', unitType: 'AMBULANCE', status: 'ON_SCENE', crew: [], currentCall: call });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /AMB-1/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancel call' }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/dispatch/calls/c1/cancel'));
  });

  it('a unit without a call has no call actions and can be set Available/Off duty', async () => {
    renderActions({ id: 'u2', unitCode: 'AMB-2', unitType: 'AMBULANCE', status: 'EN_ROUTE', crew: [], currentCall: null });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /AMB-2/ }));
    expect(screen.queryByRole('menuitem', { name: 'Complete call' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'AVAILABLE' })).toBeInTheDocument();
  });
});
