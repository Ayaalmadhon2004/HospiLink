import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SettingsProvider, useSettingsContext, IDLE_TIMEOUT_MS, type UserSettings } from '../SettingsContext';
import { apiGet, apiPut } from '../../services/api';
import { logout } from '../../services/authService';
import { DISPLAY_CACHE_KEY } from '../../utils/settingsDom';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/api', () => ({ apiGet: vi.fn(), apiPut: vi.fn() }));
vi.mock('../../services/authService', () => ({ logout: vi.fn() }));
let mockUser: { id: string } | null = { id: 'u1' };
vi.mock('../AuthContext', () => ({ useAuth: () => ({ user: mockUser, loading: false }) }));

const TICK = 1000;
const base: UserSettings = {
  profile: { id: 'u1', name: 'Dr A', email: 'a@b.c', role: 'DOCTOR', department: 'ICU', shift: 'Day', status: 'ON_DUTY' },
  notifications: {
    criticalVitalsAlerts: true, incidentEscalations: true, shiftReminders: false, dispatchAlerts: true, appointmentReminders: true,
  },
  security: { twoFactorAuth: false, autoLockIdleSessions: false, compactDensity: false },
  display: { theme: 'light', language: 'en', timezone: 'UTC' },
};

const setup = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <SettingsProvider>{children}</SettingsProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useSettingsContext(), { wrapper });
};

describe('SettingsProvider', () => {
  beforeEach(() => {
    mockUser = { id: 'u1' };
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-density');
    document.documentElement.classList.remove('compact');
    vi.mocked(apiGet).mockResolvedValue({ success: true, data: base });
  });
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('loads settings once and applies theme + density, caching a copy', async () => {
    vi.mocked(apiGet).mockResolvedValue({ success: true, data: { ...base, display: { ...base.display, theme: 'dark' }, security: { ...base.security, compactDensity: true } } });
    const { result } = setup();
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    const root = document.documentElement;
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('data-density')).toBe('compact');
    expect(root.classList.contains('compact')).toBe(true);
    expect(JSON.parse(localStorage.getItem(DISPLAY_CACHE_KEY) ?? '{}')).toEqual({ theme: 'dark', compact: true });
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('does not fetch and uses defaults when logged out', () => {
    mockUser = null;
    const { result } = setup();
    expect(result.current.settings).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('resolves "system" through matchMedia', async () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.mocked(apiGet).mockResolvedValue({ success: true, data: { ...base, display: { ...base.display, theme: 'system' } } });
    setup();
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'));
    vi.unstubAllGlobals();
  });

  it('updates optimistically and toasts on success', async () => {
    vi.mocked(apiPut).mockResolvedValue({ success: true });
    const { result } = setup();
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    await act(async () => {
      await result.current.updateDisplay({ theme: 'dark' });
    });
    await waitFor(() => expect(result.current.settings?.display.theme).toBe('dark'));
    expect(apiPut).toHaveBeenCalledWith('/settings/display', { theme: 'dark' });
    expect(toast.success).toHaveBeenCalled();
  });

  it('rolls back and toasts an error when the save fails', async () => {
    vi.mocked(apiPut).mockRejectedValue(new Error('boom'));
    const { result } = setup();
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    let res: { success: boolean } | undefined;
    await act(async () => {
      res = await result.current.updateNotifications({ shiftReminders: true });
    });
    expect(res?.success).toBe(false);
    expect(result.current.settings?.notifications.shiftReminders).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('boom');
  });

  it('logs out after the idle timeout only when auto-lock is on, and cleans up', async () => {
    vi.mocked(apiGet).mockResolvedValue({ success: true, data: { ...base, security: { ...base.security, autoLockIdleSessions: true } } });
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { result, unmount } = setup();
    await waitFor(() => expect(result.current.settings?.security.autoLockIdleSessions).toBe(true));
    vi.useFakeTimers();
    // activity restarts the countdown
    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - TICK);
      window.dispatchEvent(new Event('keydown'));
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS - TICK);
    });
    expect(logout).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(TICK);
    });
    expect(logout).toHaveBeenCalledTimes(1);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('never logs out when auto-lock is off', async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.settings).not.toBeNull());
    vi.useFakeTimers();
    await act(async () => {
      vi.advanceTimersByTime(IDLE_TIMEOUT_MS + IDLE_TIMEOUT_MS);
    });
    expect(logout).not.toHaveBeenCalled();
  });

  it('useSettings outside the provider throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Probe = () => {
      useSettingsContext();
      return null;
    };
    expect(() => render(<Probe />)).toThrow();
    spy.mockRestore();
  });
});
