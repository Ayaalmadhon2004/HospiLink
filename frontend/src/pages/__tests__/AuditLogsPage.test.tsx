import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuditLogsPage } from '../AuditLogsPage';
import { apiGet } from '../../services/api';
import i18n from '../../i18n';
import { QueryWrapper } from '../../test/QueryWrapper';
import { canAccessRoute } from '../../configs/permissions';
import { NAV_ITEMS } from '../../configs/navigation';

vi.mock('../../services/api', () => ({ apiGet: vi.fn() }));

const row = (over = {}) => ({
  id: 'a1', action: 'CREATE_WARD', entityId: 'w1', details: 'User u1 performed CREATE_WARD on /api/wards',
  createdAt: '2026-01-02T10:00:00.000Z', user: { id: 'u1', name: 'Dana Admin', email: 'd@h.com', role: 'ADMIN' }, ...over,
});
const pagination = (over = {}) => ({ page: 1, limit: 50, totalCount: 120, totalPages: 3, hasNextPage: true, hasPrevPage: false, ...over });

const mockApi = (rows = [row(), row({ id: 'a2', user: null, action: 'DELETE_WARD' })]) =>
  vi.mocked(apiGet).mockImplementation((async (url: string) =>
    url === '/audit-logs/actions' ? { success: true, data: ['CREATE_WARD', 'DELETE_WARD'] } : { success: true, data: rows, pagination: pagination() }) as never);

describe('AuditLogsPage', () => {
  beforeEach(() => {
    vi.mocked(apiGet).mockReset();
  });

  it('lists entries, including those whose user was deleted', async () => {
    mockApi();
    render(<AuditLogsPage />, { wrapper: QueryWrapper });
    expect(await screen.findByText('Dana Admin')).toBeInTheDocument();
    expect(screen.getByText('Deleted user')).toBeInTheDocument();
    expect(screen.getByTitle('CREATE_WARD')).toHaveTextContent('Ward created');
    expect(screen.getByText(/120 entries/)).toBeInTheDocument();
  });

  it('shows action names and roles in Arabic, keeping the raw action as a tooltip', async () => {
    await i18n.changeLanguage('ar');
    mockApi();
    render(<AuditLogsPage />, { wrapper: QueryWrapper });
    const action = await screen.findByTitle('CREATE_WARD');
    expect(action).toHaveTextContent('إضافة جناح');
    expect(screen.getByText('مدير')).toBeInTheDocument();
  });

  it('filtering by action queries the server and returns to page 1; paging asks for the next page', async () => {
    mockApi();
    render(<AuditLogsPage />, { wrapper: QueryWrapper });
    const user = userEvent.setup();
    await screen.findByText('Dana Admin');

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/audit-logs', expect.objectContaining({ page: 2, limit: 50 })));

    await user.selectOptions(screen.getByLabelText('Action'), 'DELETE_WARD');
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/audit-logs', expect.objectContaining({ action: 'DELETE_WARD', page: 1 })));
  });

  it('shows an error with retry when the request fails', async () => {
    vi.mocked(apiGet).mockImplementation((() => Promise.reject(new Error('boom'))) as never);
    render(<AuditLogsPage />, { wrapper: QueryWrapper });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the audit log');
  });
});

describe('audit log access', () => {
  it('only ADMIN may open /audit-logs, and the sidebar entry is gated by the same rule', () => {
    expect(canAccessRoute('ADMIN', '/audit-logs')).toBe(true);
    for (const role of ['DOCTOR', 'NURSE', 'DISPATCHER']) expect(canAccessRoute(role, '/audit-logs')).toBe(false);
    expect(NAV_ITEMS.some((i) => i.path === '/audit-logs')).toBe(true);
  });
});
