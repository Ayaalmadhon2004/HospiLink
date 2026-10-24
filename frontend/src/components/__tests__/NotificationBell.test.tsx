import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationBell } from '../NotificationBell';
import { apiGet, apiPut, apiDelete } from '../../services/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

type Handler = (n: unknown) => void;
const socketHandlers: Record<string, Handler> = {};

vi.mock('socket.io-client', () => ({
  io: () => ({
    on: (event: string, handler: Handler) => {
      socketHandlers[event] = handler;
    },
    off: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock('../../services/api', () => ({
  apiGet: vi.fn(),
  apiPut: vi.fn().mockResolvedValue({}),
  apiDelete: vi.fn().mockResolvedValue({}),
}));

const notification = (id: string, read: boolean) => ({
  id,
  type: 'INFO',
  title: `Title ${id}`,
  message: `Message ${id}`,
  read,
  link: null,
  createdAt: '2026-10-21T08:00:00.000Z',
});

const renderBell = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Same shape the backend sends: { success, data: [...], unreadCount }
    vi.mocked(apiGet).mockResolvedValue({
      success: true,
      data: [notification('1', false), notification('2', true)],
      unreadCount: 1,
    });
  });

  it('shows the unread count from the API and lists the notifications', async () => {
    const user = userEvent.setup();
    renderBell();

    expect(await screen.findByText('1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('Title 1')).toBeInTheDocument();
    expect(screen.getByText('Title 2')).toBeInTheDocument();
  });

  it('marks a notification as read when it is opened', async () => {
    const user = userEvent.setup();
    renderBell();
    await screen.findByText('1');

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    await user.click(screen.getByText('Title 1'));

    expect(apiPut).toHaveBeenCalledWith('/notifications/1/read', {});
  });

  it('lowers the unread count when an unread notification is deleted', async () => {
    const user = userEvent.setup();
    renderBell();
    await screen.findByText('1');

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    await user.click(screen.getByRole('button', { name: 'Delete notification Title 1' }));

    expect(apiDelete).toHaveBeenCalledWith('/notifications/1');
    await waitFor(() => expect(screen.queryByText('Title 1')).not.toBeInTheDocument());
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('adds a notification pushed over the socket', async () => {
    const user = userEvent.setup();
    renderBell();
    await screen.findByText('1');

    socketHandlers['new-notification'](notification('3', false));
    expect(await screen.findByText('2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('Title 3')).toBeInTheDocument();
  });

  it('shows a toast (by severity) when a notification arrives over the socket', async () => {
    renderBell();
    await screen.findByText('1');

    socketHandlers['new-notification']({ ...notification('9', false), type: 'VITALS', link: '/patients/p1' });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Title 9', expect.objectContaining({ description: 'Message 9' })),
    );
  });

  it('filters to unread notifications', async () => {
    const user = userEvent.setup();
    renderBell();
    await screen.findByText('1');

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    await user.click(screen.getByRole('button', { name: 'Unread' }));

    expect(screen.getByText('Title 1')).toBeInTheDocument();
    expect(screen.queryByText('Title 2')).not.toBeInTheDocument();
  });

  it('marks everything as read', async () => {
    const user = userEvent.setup();
    renderBell();
    await screen.findByText('1');

    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }));

    expect(apiPut).toHaveBeenCalledWith('/notifications/read-all', {});
  });
});
