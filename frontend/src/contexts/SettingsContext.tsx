// frontend/src/contexts/SettingsContext.tsx
// Loads the user's settings once after login and applies them app-wide (theme, language/dir, density,
// timezone, idle auto-lock). Pages read/update them through the `useSettings` hook.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n, { isSupported } from '../i18n';
import { apiGet, apiPut } from '../services/api';
import { logout } from '../services/authService';
import { getErrorMessage } from '../types/api';
import { logger } from '../utils/logger';
import { setActiveTimezone } from '../utils/datetime';
import { applyDisplay, readDisplayCache, resolveTheme, writeDisplayCache, DEFAULT_DISPLAY } from '../utils/settingsDom';
import { useAuth } from './AuthContext';

export interface ProfileSettings {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  shift: string;
  status: string;
}

export interface NotificationSettings {
  criticalVitalsAlerts: boolean;
  incidentEscalations: boolean;
  shiftReminders: boolean;
  dispatchAlerts: boolean;
  appointmentReminders: boolean;
}

export interface SecuritySettings {
  twoFactorAuth: boolean;
  autoLockIdleSessions: boolean;
  compactDensity: boolean;
}

export interface DisplaySettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
}

export interface UserSettings {
  profile: ProfileSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
  display: DisplaySettings;
}

type Section = keyof UserSettings;
export interface UpdateResult {
  success: boolean;
  error?: string;
}

// eslint-disable-next-line react-refresh/only-export-components -- shared constants live next to the provider
export const SETTINGS_QUERY_KEY = ['settings'] as const;
const IDLE_MINUTES = 10;
const MS_PER_MINUTE = 60_000;
export const IDLE_TIMEOUT_MS = IDLE_MINUTES * MS_PER_MINUTE;
const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

export interface SettingsContextValue {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  updateProfile: (data: Partial<ProfileSettings>) => Promise<UpdateResult>;
  updateNotifications: (data: Partial<NotificationSettings>) => Promise<UpdateResult>;
  updateSecurity: (data: Partial<SecuritySettings>) => Promise<UpdateResult>;
  updateDisplay: (data: Partial<DisplaySettings>) => Promise<UpdateResult>;
  refresh: () => Promise<unknown>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context object lives next to its provider
export const SettingsContext = createContext<SettingsContextValue | null>(null);

interface UpdateVars {
  section: Section;
  data: Record<string, unknown>;
}

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<UserSettings>({
    queryKey: SETTINGS_QUERY_KEY,
    enabled: !!user,
    queryFn: async () => {
      const res = await apiGet<UserSettings & { data?: UserSettings }>('/settings');
      return res.data || res;
    },
  });
  const settings = user ? query.data ?? null : null;

  const mutation = useMutation<
    { data?: Partial<ProfileSettings> },
    unknown,
    UpdateVars,
    { previous: UserSettings | undefined }
  >({
    mutationFn: ({ section, data }) => apiPut(`/settings/${section}`, data),
    onMutate: async ({ section, data }) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_QUERY_KEY });
      const previous = queryClient.getQueryData<UserSettings>(SETTINGS_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<UserSettings>(SETTINGS_QUERY_KEY, {
          ...previous,
          [section]: { ...previous[section], ...data },
        });
      }
      return { previous };
    },
    onError: (err, _vars, context) => {
      logger.error('Update settings error:', err);
      if (context?.previous) queryClient.setQueryData(SETTINGS_QUERY_KEY, context.previous);
      toast.error(getErrorMessage(err, i18n.t('settings.saveError')));
    },
    onSuccess: (res, { section }) => {
      if (section === 'profile' && res?.data) {
        queryClient.setQueryData<UserSettings>(SETTINGS_QUERY_KEY, (prev) =>
          prev ? { ...prev, profile: { ...prev.profile, ...res.data } } : prev,
        );
      }
      toast.success(i18n.t(section === 'profile' ? 'settings.profileUpdated' : 'settings.saved'));
    },
  });

  const { mutateAsync } = mutation;
  const update = useCallback(
    async (section: Section, data: object): Promise<UpdateResult> => {
      try {
        await mutateAsync({ section, data: data as Record<string, unknown> });
        return { success: true };
      } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, '') };
      }
    },
    [mutateAsync],
  );

  const refetch = query.refetch;
  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      loading: !!user && query.isPending,
      error: query.isError ? getErrorMessage(query.error, i18n.t('settings.fetchError')) : null,
      updateProfile: (data) => update('profile', data),
      updateNotifications: (data) => update('notifications', data),
      updateSecurity: (data) => update('security', data),
      updateDisplay: (data) => update('display', data),
      refresh: () => refetch(),
    }),
    [settings, user, query.isPending, query.isError, query.error, update, refetch],
  );

  // ── Theme + density: server value when available, else the localStorage copy, else defaults ──
  const theme = settings?.display.theme ?? (user ? readDisplayCache().theme : DEFAULT_DISPLAY.theme);
  const compact = settings?.security.compactDensity ?? (user ? readDisplayCache().compact : false);
  useEffect(() => {
    applyDisplay({ theme, compact });
    if (settings) writeDisplayCache({ theme, compact });
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;
    // follow OS changes while the user picked "system"
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => document.documentElement.setAttribute('data-theme', resolveTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, compact, settings]);

  // ── Language (lang/dir are set by the i18n languageChanged handler) and timezone ──
  const language = settings?.display.language;
  useEffect(() => {
    if (language && isSupported(language) && i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);

  const timezone = settings?.display.timezone;
  useEffect(() => {
    setActiveTimezone(timezone);
  }, [timezone]);

  // ── Auto-lock: log out after IDLE_TIMEOUT_MS without activity (only when enabled) ──
  const autoLock = !!user && settings?.security.autoLockIdleSessions === true;
  const lockedRef = useRef(false);
  useEffect(() => {
    if (!autoLock) return;
    let timer: ReturnType<typeof setTimeout>;
    const lock = () => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      void logout();
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, IDLE_TIMEOUT_MS);
    };
    reset();
    IDLE_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      IDLE_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [autoLock]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- hook must stay next to its provider
export const useSettingsContext = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
};
