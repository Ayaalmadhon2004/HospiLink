// frontend/src/pages/SettingsPage.tsx
import { useState } from 'react';
import useSettings from '../hooks/useSettings';
import { Bell, Shield, Monitor, User, Loader2, Check } from 'lucide-react';

const Toggle: React.FC<{
  enabled: boolean;
  onChange: () => void;
  label: string;
}> = ({ enabled, onChange, label }) => (
  <button
    onClick={onChange}
    className={`relative w-12 h-7 rounded-full transition-colors ${
      enabled ? 'bg-teal-500' : 'bg-gray-300'
    }`}
    role="switch"
    aria-checked={enabled}
    aria-label={label}
  >
    <span
      className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
        enabled ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const SettingsPage: React.FC = () => {
  const { settings, loading: settingsLoading, updateProfile, updateNotifications, updateSecurity, updateDisplay } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [profileEdit, setProfileEdit] = useState({ name: '', department: '', shift: '' });

  const loading = settingsLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          Failed to load settings. Please refresh the page.
        </div>
      </div>
    );
  }

  const handleToggle = async (
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

  const handleProfileSave = async () => {
    setSaving(true);
    const result = await updateProfile({
      name: profileEdit.name || settings.profile.name,
      department: profileEdit.department || settings.profile.department,
      shift: profileEdit.shift || settings.profile.shift,
    });
    setSaving(false);
    if (result.success) {
      setSaveMessage('Profile updated');
      setProfileEdit({ name: '', department: '', shift: '' });
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Settings</h1>

      {saveMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg flex items-center gap-2" role="alert">
          <Check className="w-4 h-4" />
          {saveMessage}
        </div>
      )}

      {/* Profile Section - EDITABLE */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-800">Profile</h2>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full name</label>
            <input
              type="text"
              defaultValue={settings.profile.name}
              onChange={(e) => setProfileEdit(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <input
              type="text"
              value={settings.profile.role}
              disabled
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={settings.profile.email}
              disabled
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <input
              type="text"
              defaultValue={settings.profile.department}
              onChange={(e) => setProfileEdit(prev => ({ ...prev, department: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shift</label>
            <input
              type="text"
              defaultValue={settings.profile.shift}
              onChange={(e) => setProfileEdit(prev => ({ ...prev, shift: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleProfileSave}
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
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
              onChange={() => handleToggle('criticalVitalsAlerts', settings.notifications.criticalVitalsAlerts, updateNotifications)}
              label="Toggle critical vitals alerts"
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Incident escalations</h3>
              <p className="text-sm text-gray-500">Notify when an incident upgrades to Code Orange or higher.</p>
            </div>
            <Toggle
              enabled={settings.notifications.incidentEscalations}
              onChange={() => handleToggle('incidentEscalations', settings.notifications.incidentEscalations, updateNotifications)}
              label="Toggle incident escalation notifications"
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Shift reminders</h3>
              <p className="text-sm text-gray-500">Remind assigned staff 30 minutes before shift starts.</p>
            </div>
            <Toggle
              enabled={settings.notifications.shiftReminders}
              onChange={() => handleToggle('shiftReminders', settings.notifications.shiftReminders, updateNotifications)}
              label="Toggle shift reminders"
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Dispatch alerts</h3>
              <p className="text-sm text-gray-500">Notify on new dispatch assignments.</p>
            </div>
            <Toggle
              enabled={settings.notifications.dispatchAlerts}
              onChange={() => handleToggle('dispatchAlerts', settings.notifications.dispatchAlerts, updateNotifications)}
              label="Toggle dispatch alerts"
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Appointment reminders</h3>
              <p className="text-sm text-gray-500">Notify patients and staff of upcoming appointments.</p>
            </div>
            <Toggle
              enabled={settings.notifications.appointmentReminders}
              onChange={() => handleToggle('appointmentReminders', settings.notifications.appointmentReminders, updateNotifications)}
              label="Toggle appointment reminders"
            />
          </div>
        </div>
      </section>

      {/* Security & Display Section */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
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
              onChange={() => handleToggle('twoFactorAuth', settings.security.twoFactorAuth, updateSecurity)}
              label="Toggle two-factor authentication"
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Auto-lock idle sessions</h3>
              <p className="text-sm text-gray-500">Lock the dashboard after 10 minutes of inactivity.</p>
            </div>
            <Toggle
              enabled={settings.security.autoLockIdleSessions}
              onChange={() => handleToggle('autoLockIdleSessions', settings.security.autoLockIdleSessions, updateSecurity)}
              label="Toggle auto-lock idle sessions"
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">Compact density</h3>
              <p className="text-sm text-gray-500">Reduce spacing to fit more information on screen.</p>
            </div>
            <Toggle
              enabled={settings.security.compactDensity}
              onChange={() => handleToggle('compactDensity', settings.security.compactDensity, updateSecurity)}
              label="Toggle compact density"
            />
          </div>
        </div>
      </section>

      {/* Display Preferences */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Monitor className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-800">Display</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
            <select
              value={settings.display.theme}
              onChange={(e) => updateDisplay({ theme: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
            <select
              value={settings.display.language}
              onChange={(e) => updateDisplay({ language: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
            <input
              type="text"
              value={settings.display.timezone}
              onChange={(e) => updateDisplay({ timezone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;