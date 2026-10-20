// frontend/src/hooks/useSettings.ts
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '../services/api';
import { getErrorMessage, type ApiResponse } from '../types/api';

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

const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<UserSettings & { data?: UserSettings }>('/settings');
      setSettings(res.data || res);
      setError(null);
    } catch (err: unknown) {
      console.error('Settings fetch error:', err);
      setError(getErrorMessage(err, 'Failed to fetch settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Update profile (name, department, shift)
  const updateProfile = async (data: Partial<ProfileSettings>) => {
    try {
      const res = await apiPut<ApiResponse<{ data: Partial<ProfileSettings> }>>('/settings/profile', data);
      setSettings(prev => prev ? { ...prev, profile: { ...prev.profile, ...res.data.data } } : null);
      return { success: true, data: res.data.data };
    } catch (err: unknown) {
      console.error('Update profile error:', err);
      return { success: false, error: getErrorMessage(err, '') };
    }
  };

  const updateNotifications = async (data: Partial<NotificationSettings>) => {
    try {
      await apiPut('/settings/notifications', data);
      setSettings(prev => prev ? { ...prev, notifications: { ...prev.notifications, ...data } } : null);
      return { success: true };
    } catch (err: unknown) {
      console.error('Update notifications error:', err);
      return { success: false, error: getErrorMessage(err, '') };
    }
  };

  const updateSecurity = async (data: Partial<SecuritySettings>) => {
    try {
      await apiPut('/settings/security', data);
      setSettings(prev => prev ? { ...prev, security: { ...prev.security, ...data } } : null);
      return { success: true };
    } catch (err: unknown) {
      console.error('Update security error:', err);
      return { success: false, error: getErrorMessage(err, '') };
    }
  };

  const updateDisplay = async (data: Partial<DisplaySettings>) => {
    try {
      await apiPut('/settings/display', data);
      setSettings(prev => prev ? { ...prev, display: { ...prev.display, ...data } } : null);
      return { success: true };
    } catch (err: unknown) {
      console.error('Update display error:', err);
      return { success: false, error: getErrorMessage(err, '') };
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- effect intentionally syncs/fetches into state (data load or reset on prop change); restructuring would change behaviour
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    updateProfile,
    updateNotifications,
    updateSecurity,
    updateDisplay,
    refresh: fetchSettings
  };
};

export default useSettings;