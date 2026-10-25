import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportMenu } from '../Export/ExportMenu';
import { exportFileName } from '../../services/exportService';
import { api } from '../../services/api';
import { ApiError } from '../../services/apiError';
import { toast } from 'sonner';
import { hasPermission } from '../../configs/permissions';

vi.mock('../../services/api', () => ({ api: { get: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const useAuth = vi.fn();
vi.mock('../../contexts/authContext', () => ({ useAuth: () => useAuth() }));

let clicked: { href: string; download: string } | null;

beforeEach(() => {
  vi.mocked(api.get).mockReset().mockResolvedValue({ data: new Blob(['x']) } as never);
  vi.mocked(toast.error).mockReset();
  clicked = null;
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked = { href: this.href, download: this.download };
  });
});
afterEach(() => vi.restoreAllMocks());

const open = async (type: 'patients' | 'billing', role: string) => {
  useAuth.mockReturnValue({ user: { role } });
  const user = userEvent.setup();
  render(<ExportMenu type={type} />);
  await user.click(screen.getByRole('button', { name: 'Export' }));
  return user;
};

describe('ExportMenu', () => {
  it('permissions mirror the server: clinical exports ADMIN/DOCTOR, billing ADMIN only', () => {
    expect(hasPermission('NURSE', 'export:clinical')).toBe(false);
    expect(hasPermission('DOCTOR', 'export:billing')).toBe(false);
    expect(hasPermission('ADMIN', 'export:billing')).toBe(true);
  });

  it.each([['NURSE', 'patients'], ['DISPATCHER', 'patients'], ['DOCTOR', 'billing'], ['NURSE', 'billing']] as const)('%s sees no %s export button', (role, type) => {
    useAuth.mockReturnValue({ user: { role } });
    render(<ExportMenu type={type} />);
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
  });

  it('downloads an Excel file for the picked period (to = start of the next day) via the authenticated client', async () => {
    const user = await open('patients', 'DOCTOR');
    await user.type(screen.getByLabelText('From'), '2026-01-01');
    await user.type(screen.getByLabelText('To'), '2026-01-31');
    await user.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    const [url, config] = vi.mocked(api.get).mock.calls[0] as [string, { params: Record<string, string>; responseType: string }];
    expect(url).toBe('/exports/patients');
    expect(config.responseType).toBe('blob');
    expect(config.params).toEqual({ format: 'xlsx', from: new Date(2026, 0, 1).toISOString(), to: new Date(2026, 1, 1).toISOString() });
    await waitFor(() => expect(clicked).not.toBeNull());
    expect(clicked?.download).toBe(exportFileName('patients', 'xlsx'));
    expect(clicked?.href).toBe('blob:fake');
  });

  it('PDF with no dates leaves the period to the server default', async () => {
    const user = await open('billing', 'ADMIN');
    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect((vi.mocked(api.get).mock.calls[0][1] as { params: object }).params).toEqual({ format: 'pdf', from: undefined, to: undefined });
    expect(clicked?.download).toMatch(/^hospilink-billing-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('blocks an inverted period instead of calling the server', async () => {
    const user = await open('patients', 'ADMIN');
    await user.type(screen.getByLabelText('From'), '2026-02-10');
    await user.type(screen.getByLabelText('To'), '2026-02-01');
    expect(screen.getByRole('alert')).toHaveTextContent('"From" must not be after "To"');
    expect(screen.getByRole('button', { name: 'Excel' })).toBeDisabled();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('413 shows the "too many rows" message and downloads nothing; other failures show a generic message', async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new ApiError('too big', { status: 413, code: 'EXPORT_TOO_LARGE' }));
    const user = await open('patients', 'ADMIN');
    await user.click(screen.getByRole('button', { name: 'Excel' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Too many rows for one export. Choose a shorter period.'));
    expect(clicked).toBeNull();
    expect(screen.getByRole('button', { name: 'Excel' })).toBeEnabled(); // menu stays open to retry

    vi.mocked(api.get).mockRejectedValueOnce(new ApiError('Server error', { status: 500 }));
    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await waitFor(() => expect(toast.error).toHaveBeenLastCalledWith('Server error'));
  });
});
