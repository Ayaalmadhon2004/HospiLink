// frontend/src/pages/SettingsPage.tsx
import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSettings, { type DisplaySettings } from '../hooks/useSettings';
import { Bell, Shield, Monitor, User, Building2, Loader2 } from 'lucide-react';
import { getTimezoneOptions } from '../utils/datetime';
import { TwoFactorPanel } from '../components/TwoFactorPanel';
import { Field, SectionHeader, SettingRow, Toggle } from '../components/Settings/SettingsParts';
import { ProfileForm } from '../components/Settings/ProfileForm';
import { FIELD_GRID, INPUT_CLASS, READONLY_CLASS } from '../components/Settings/settingsStyles';

const NOTIFICATION_KEYS = [
  'criticalVitalsAlerts',
  'incidentEscalations',
  'shiftReminders',
  'dispatchAlerts',
  'appointmentReminders',
] as const;

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const uid = useId();
  const {
    settings,
    loading,
    updateProfile,
    updateNotifications,
    updateSecurity,
    updateDisplay,
    refresh,
  } = useSettings();

  const timezones = useMemo(() => {
    const zones = getTimezoneOptions();
    const current = settings?.display.timezone;
    return current && !zones.includes(current) ? [current, ...zones] : zones;
  }, [settings?.display.timezone]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-500" role="status">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
          <span>{t('settings.loading')}</span>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg" role="alert">
          {t('settings.loadError')}
        </div>
      </div>
    );
  }

  // Optimistic update + success/error toasts are handled by SettingsProvider.
  const flip = (
    key: string,
    current: boolean,
    updateFn: (data: Record<string, boolean>) => Promise<{ success: boolean }>
  ) => void updateFn({ [key]: !current });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t('settings.title')}</h1>

      <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <SectionHeader icon={<User className="w-5 h-5 text-teal-600" aria-hidden="true" />} title={t('settings.profile.title')} />
        {/* key: re-seed the form when the saved profile changes */}
        <ProfileForm
          key={`${settings.profile.name}|${settings.profile.department}|${settings.profile.shift}`}
          profile={settings.profile}
          onSave={updateProfile}
        />
      </section>

      {settings.hospital?.code && (
        <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
          <SectionHeader icon={<Building2 className="w-5 h-5 text-teal-600" aria-hidden="true" />} title={t('settings.hospital.title')} />
          <Field label={settings.hospital.name} htmlFor="hospital-code">
            <input id="hospital-code" type="text" readOnly value={settings.hospital.code} className={`${READONLY_CLASS} font-mono tracking-wider`} />
          </Field>
          <p className="text-sm text-gray-500 mt-2">{t('settings.hospital.hint')}</p>
        </section>
      )}

      <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <SectionHeader icon={<Bell className="w-5 h-5 text-teal-600" aria-hidden="true" />} title={t('settings.notifications.title')} />
        <div className="space-y-6">
          {NOTIFICATION_KEYS.map((key, i) => (
            <SettingRow
              key={key}
              first={i === 0}
              title={t(`settings.notifications.${key}.title`)}
              description={t(`settings.notifications.${key}.description`)}
            >
              <Toggle
                enabled={settings.notifications[key]}
                onChange={() => flip(key, settings.notifications[key], updateNotifications)}
                label={t(`settings.notifications.${key}.toggle`)}
              />
            </SettingRow>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <SectionHeader icon={<Shield className="w-5 h-5 text-teal-600" aria-hidden="true" />} title={t('settings.security.title')} />
        <div className="space-y-6">
          <TwoFactorPanel enabled={settings.security.twoFactorAuth} onChanged={() => void refresh()} />
          <SettingRow
            title={t('settings.security.autoLockIdleSessions.title')}
            description={t('settings.security.autoLockIdleSessions.description')}
          >
            <Toggle
              enabled={settings.security.autoLockIdleSessions}
              onChange={() => flip('autoLockIdleSessions', settings.security.autoLockIdleSessions, updateSecurity)}
              label={t('settings.security.autoLockIdleSessions.toggle')}
            />
          </SettingRow>
          <SettingRow
            title={t('settings.security.compactDensity.title')}
            description={t('settings.security.compactDensity.description')}
          >
            <Toggle
              enabled={settings.security.compactDensity}
              onChange={() => flip('compactDensity', settings.security.compactDensity, updateSecurity)}
              label={t('settings.security.compactDensity.toggle')}
            />
          </SettingRow>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <SectionHeader icon={<Monitor className="w-5 h-5 text-teal-600" aria-hidden="true" />} title={t('settings.display.title')} />
        <div className={FIELD_GRID}>
          <Field label={t('settings.display.theme')} htmlFor={`${uid}-theme`}>
            <select
              id={`${uid}-theme`}
              value={settings.display.theme}
              onChange={(e) => void updateDisplay({ theme: e.target.value as DisplaySettings['theme'] })}
              className={INPUT_CLASS}
            >
              <option value="light">{t('settings.display.light')}</option>
              <option value="dark">{t('settings.display.dark')}</option>
              <option value="system">{t('settings.display.system')}</option>
            </select>
          </Field>
          <Field label={t('settings.display.language')} htmlFor={`${uid}-language`}>
            {/* The provider applies the language (i18n, lang/dir) from the saved setting. */}
            <select
              id={`${uid}-language`}
              value={settings.display.language}
              onChange={(e) => void updateDisplay({ language: e.target.value })}
              className={INPUT_CLASS}
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </Field>
          <Field label={t('settings.display.timezone')} htmlFor={`${uid}-timezone`}>
            <select
              id={`${uid}-timezone`}
              value={settings.display.timezone}
              onChange={(e) => void updateDisplay({ timezone: e.target.value })}
              className={INPUT_CLASS}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
