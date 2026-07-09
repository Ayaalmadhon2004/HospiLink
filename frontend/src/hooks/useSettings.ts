// frontend/src/hooks/useSettings.ts
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

export const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // جلب الإعدادات
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/settings`, { withCredentials: true });
      setSettings(res.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, []);

  // تحديث الإشعارات
  const updateNotifications = async (data: Partial<NotificationSettings>) => {
    try {
      const res = await axios.put(`${API_URL}/settings/notifications`, data, {
        withCredentials: true
      });
      setSettings(prev => prev ? { ...prev, notifications: { ...prev.notifications, ...data } } : null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message };
    }
  };

  // تحديث الأمان
  const updateSecurity = async (data: Partial<SecuritySettings>) => {
    try {
      const res = await axios.put(`${API_URL}/settings/security`, data, {
        withCredentials: true
      });
      setSettings(prev => prev ? { ...prev, security: { ...prev.security, ...data } } : null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message };
    }
  };

  // تحديث العرض
  const updateDisplay = async (data: Partial<DisplaySettings>) => {
    try {
      const res = await axios.put(`${API_URL}/settings/display`, data, {
        withCredentials: true
      });
      setSettings(prev => prev ? { ...prev, display: { ...prev.display, ...data } } : null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message };
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