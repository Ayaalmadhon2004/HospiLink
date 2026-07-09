// frontend/src/pages/Settings/SettingsPage.tsx
import React, { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { Bell, Shield, Monitor, User } from 'lucide-react'; // أو أي icons library

const Toggle: React.FC<{
  enabled: boolean;
  onChange: () => void;
}> = ({ enabled, onChange }) => (
  <button
    onClick={onChange}
    className={`relative w-12 h-7 rounded-full transition-colors ${
      enabled ? 'bg-teal-500' : 'bg-gray-300'
    }`}
  >
    <span
      className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
        enabled ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const SettingsPage: React.FC = () => {
  const { settings, loading, updateNotifications, updateSecurity, updateDisplay } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  if (loading) return <div className="p-8">Loading...</div>;
  if (!settings) return <div className="p-8">Failed to load settings</div>;

  const handleToggle = async (
    section: 'notifications' | 'security',
    key: string,
    currentValue: boolean,
    updateFn: (data: any) => Promise<any>
  ) => {
    setSaving(true);
    const result = await updateFn({ [key]: !currentValue });
    setSaving(false);
    
    if (result.success) {
      setSaveMessage('Saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

      {/* Save Message */}
      {saveMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
          {saveMessage}
        </div>
      )}

      {/* Profile Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-800">Profile</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full name
            </label>
            <input
              type="text"
              value="Dr. Elena Rivera"
              disabled
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <input
              type="text"
              value="Chief of Medicine"
              disabled
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600"
            />
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-800">Notifications</h2>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Critical vitals alerts</h3>
              <p className="text-sm text-gray-500">Push alerts when a patient enters a critical range.</p>
            </div>
            <Toggle
              enabled={settings.notifications.criticalVitalsAlerts}
              onChange={() => handleToggle(
                'notifications',
                'criticalVitalsAlerts',
                settings.notifications.criticalVitalsAlerts,
                updateNotifications
              )}
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Incident escalations</h3>
              <p className="text-sm text-gray-500">Notify me when an incident is upgraded to Code Orange or higher.</p>
            </div>
            <Toggle
              enabled={settings.notifications.incidentEscalations}
              onChange={() => handleToggle(
                'notifications',
                'incidentEscalations',
                settings.notifications.incidentEscalations,
                updateNotifications
              )}
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Shift reminders</h3>
              <p className="text-sm text-gray-500">Remind assigned staff 30 minutes before a shift starts.</p>
            </div>
            <Toggle
              enabled={settings.notifications.shiftReminders}
              onChange={() => handleToggle(
                'notifications',
                'shiftReminders',
                settings.notifications.shiftReminders,
                updateNotifications
              )}
            />
          </div>
        </div>
      </div>

      {/* Security & Display Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-800">Security & Display</h2>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Two-factor authentication</h3>
              <p className="text-sm text-gray-500">Require a verification code on new device sign-ins.</p>
            </div>
            <Toggle
              enabled={settings.security.twoFactorAuth}
              onChange={() => handleToggle(
                'security',
                'twoFactorAuth',
                settings.security.twoFactorAuth,
                updateSecurity
              )}
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Auto-lock idle sessions</h3>
              <p className="text-sm text-gray-500">Lock the dashboard after 10 minutes of inactivity.</p>
            </div>
            <Toggle
              enabled={settings.security.autoLockIdleSessions}
              onChange={() => handleToggle(
                'security',
                'autoLockIdleSessions',
                settings.security.autoLockIdleSessions,
                updateSecurity
              )}
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Compact density</h3>
              <p className="text-sm text-gray-500">Reduce spacing to fit more information on screen.</p>
            </div>
            <Toggle
              enabled={settings.security.compactDensity}
              onChange={() => handleToggle(
                'security',
                'compactDensity',
                settings.security.compactDensity,
                updateSecurity
              )}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2 text-gray-600">
          <Monitor className="w-5 h-5" />
          <span>St. Meridian General · Facility ID SMG-001</span>
        </div>
        <button
          disabled={saving}
          className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;