// frontend/src/contexts/settingsContext.ts
// Types, constants and the context object of the settings; the provider lives in SettingsContext.tsx.
import { createContext, useContext } from 'react';

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

// `code` (the signup code) is only sent to ADMIN users.
export interface HospitalInfo {
  name: string;
  code?: string;
}

export interface UserSettings {
  profile: ProfileSettings;
  hospital?: HospitalInfo | null;
  notifications: NotificationSettings;
  security: SecuritySettings;
  display: DisplaySettings;
}

export type SettingsSection = Exclude<keyof UserSettings, 'hospital'>;
export interface UpdateResult {
  success: boolean;
  error?: string;
}

export const SETTINGS_QUERY_KEY = ['settings'] as const;
const IDLE_MINUTES = 10;
const MS_PER_MINUTE = 60_000;
export const IDLE_TIMEOUT_MS = IDLE_MINUTES * MS_PER_MINUTE;
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

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export const useSettingsContext = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
};
