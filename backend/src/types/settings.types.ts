// src/types/settings.types.ts
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
  id: string;
  userId: string;
  notifications: NotificationSettings;
  security: SecuritySettings;
  display: DisplaySettings;
}