// frontend/src/pages/SettingsPage.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSettings, { type DisplaySettings } from '../hooks/useSettings';
import { Bell, Shield, Monitor, User, Loader2, Check } from 'lucide-react';
import { isSupported } from '../i18n';

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
      className={`absolute top-1 start-1 w-5 h-5 bg-white rounded-full transition-transform ${
        enabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
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
          <span>{t('settings.loading')}</span>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {t('settings.loadError')}
        </div>
      </div>
    );
  }

  const handleToggle = async (
    key: string,
    currentValue: boolean,
    updateFn: (data: Record<string, boolean>) => Promise<{ success: boolean }>
  ) => {
    setSaving(true);
    const result = await updateFn({ [key]: !currentValue });
    setSaving(false);
    if (result.success) {
      setSaveMessage(t('settings.saved'));
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
      setSaveMessage(t('settings.profileUpdated'));
      setProfileEdit({ name: '', department: '', shift: '' });
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('settings.title')}</h1>

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
          <h2 className="text-lg font-semibold text-gray-800">{t('settings.profile.title')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.profile.fullName')}</label>
            <input
              type="text"
              defaultValue={settings.profile.name}
              onChange={(e) => setProfileEdit(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.profile.role')}</label>
            <input
              type="text"
              value={settings.profile.role}
              disabled
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.profile.email')}</label>
            <input
              type="email"
              value={settings.profile.email}
              disabled
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.profile.department')}</label>
            <input
              type="text"
              defaultValue={settings.profile.department}
              onChange={(e) => setProfileEdit(prev => ({ ...prev, department: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.profile.shift')}</label>
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
              {saving ? t('common.saving') : t('settings.profile.save')}
            </button>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-800">{t('settings.notifications.title')}</h2>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">{t('settings.notifications.criticalVitalsAlerts.title')}</h3>
              <p className="text-sm text-gray-500">{t('settings.notifications.criticalVitalsAlerts.description')}</p>
            </div>
            <Toggle
              enabled={settings.notifications.criticalVitalsAlerts}
              onChange={() => handleToggle('criticalVitalsAlerts', settings.notifications.criticalVitalsAlerts, updateNotifications)}
              label={t('settings.notifications.criticalVitalsAlerts.toggle')}
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">{t('settings.notifications.incidentEscalations.title')}</h3>
              <p className="text-sm text-gray-500">{t('settings.notifications.incidentEscalations.description')}</p>
            </div>
            <Toggle
              enabled={settings.notifications.incidentEscalations}
              onChange={() => handleToggle('incidentEscalations', settings.notifications.incidentEscalations, updateNotifications)}
              label={t('settings.notifications.incidentEscalations.toggle')}
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">{t('settings.notifications.shiftReminders.title')}</h3>
              <p className="text-sm text-gray-500">{t('settings.notifications.shiftReminders.description')}</p>
            </div>
            <Toggle
              enabled={settings.notifications.shiftReminders}
              onChange={() => handleToggle('shiftReminders', settings.notifications.shiftReminders, updateNotifications)}
              label={t('settings.notifications.shiftReminders.toggle')}
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">{t('settings.notifications.dispatchAlerts.title')}</h3>
              <p className="text-sm text-gray-500">{t('settings.notifications.dispatchAlerts.description')}</p>
            </div>
            <Toggle
              enabled={settings.notifications.dispatchAlerts}
              onChange={() => handleToggle('dispatchAlerts', settings.notifications.dispatchAlerts, updateNotifications)}
              label={t('settings.notifications.dispatchAlerts.toggle')}
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">{t('settings.notifications.appointmentReminders.title')}</h3>
              <p className="text-sm text-gray-500">{t('settings.notifications.appointmentReminders.description')}</p>
            </div>
            <Toggle
              enabled={settings.notifications.appointmentReminders}
              onChange={() => handleToggle('appointmentReminders', settings.notifications.appointmentReminders, updateNotifications)}
              label={t('settings.notifications.appointmentReminders.toggle')}
            />
          </div>
        </div>
      </section>

      {/* Security & Display Section */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-800">{t('settings.security.title')}</h2>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">{t('settings.security.twoFactorAuth.title')}</h3>
              <p className="text-sm text-gray-500">{t('settings.security.twoFactorAuth.description')}</p>
            </div>
            <Toggle
              enabled={settings.security.twoFactorAuth}
              onChange={() => handleToggle('twoFactorAuth', settings.security.twoFactorAuth, updateSecurity)}
              label={t('settings.security.twoFactorAuth.toggle')}
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">{t('settings.security.autoLockIdleSessions.title')}</h3>
              <p className="text-sm text-gray-500">{t('settings.security.autoLockIdleSessions.description')}</p>
            </div>
            <Toggle
              enabled={settings.security.autoLockIdleSessions}
              onChange={() => handleToggle('autoLockIdleSessions', settings.security.autoLockIdleSessions, updateSecurity)}
              label={t('settings.security.autoLockIdleSessions.toggle')}
            />
          </div>
          <div className="border-t pt-6 flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-800">{t('settings.security.compactDensity.title')}</h3>
              <p className="text-sm text-gray-500">{t('settings.security.compactDensity.description')}</p>
            </div>
            <Toggle
              enabled={settings.security.compactDensity}
              onChange={() => handleToggle('compactDensity', settings.security.compactDensity, updateSecurity)}
              label={t('settings.security.compactDensity.toggle')}
            />
          </div>
        </div>
      </section>

      {/* Display Preferences */}
      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Monitor className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-800">{t('settings.display.title')}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.display.theme')}</label>
            <select
              value={settings.display.theme}
              onChange={(e) => updateDisplay({ theme: e.target.value as DisplaySettings['theme'] })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="light">{t('settings.display.light')}</option>
              <option value="dark">{t('settings.display.dark')}</option>
              <option value="system">{t('settings.display.system')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.display.language')}</label>
            <select
              value={isSupported(i18n.language) ? i18n.language : settings.display.language}
              onChange={(e) => {
                updateDisplay({ language: e.target.value });
                if (isSupported(e.target.value)) void i18n.changeLanguage(e.target.value);
              }}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white"
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('settings.display.timezone')}</label>
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