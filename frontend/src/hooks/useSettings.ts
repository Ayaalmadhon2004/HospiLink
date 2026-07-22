// frontend/src/hooks/useSettings.ts
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut } from '../services/api';

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
  notifications: NotificationSettings;
  security: SecuritySettings;
  display: DisplaySettings;
}

const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // جلب الإعدادات
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<any>('/settings');
      setSettings(res.data || res);
      setError(null);
    } catch (err: any) {
      console.error('Settings fetch error:', err);
      setError(err.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, []);

  // تحديث الإشعارات
  const updateNotifications = async (data: Partial<NotificationSettings>) => {
    try {
      await apiPut('/settings/notifications', data);
      setSettings(prev => prev ? { ...prev, notifications: { ...prev.notifications, ...data } } : null);
      return { success: true };
    } catch (err: any) {
      console.error('Update notifications error:', err);
      return { success: false, error: err.message };
    }
  };

  // تحديث الأمان
  const updateSecurity = async (data: Partial<SecuritySettings>) => {
    try {
      await apiPut('/settings/security', data);
      setSettings(prev => prev ? { ...prev, security: { ...prev.security, ...data } } : null);
      return { success: true };
    } catch (err: any) {
      console.error('Update security error:', err);
      return { success: false, error: err.message };
    }
  };

  // تحديث العرض
  const updateDisplay = async (data: Partial<DisplaySettings>) => {
    try {
      await apiPut('/settings/display', data);
      setSettings(prev => prev ? { ...prev, display: { ...prev.display, ...data } } : null);
      return { success: true };
    } catch (err: any) {
      console.error('Update display error:', err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    updateNotifications,
    updateSecurity,
    updateDisplay,
    refresh: fetchSettings
  };
};

export default useSettings;