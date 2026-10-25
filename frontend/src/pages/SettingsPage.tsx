// frontend/src/pages/SettingsPage.tsx
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSettings, { type DisplaySettings, type ProfileSettings } from '../hooks/useSettings';
import { Bell, Shield, Monitor, User, Building2, Loader2 } from 'lucide-react';
import { getTimezoneOptions } from '../utils/datetime';
import { enumLabel } from '../utils/enumLabel';
import { TwoFactorPanel } from '../components/TwoFactorPanel';

const FIELD_GRID = 'grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4';
const INPUT_CLASS =
  'w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-teal-500 outline-none';
const READONLY_CLASS = 'w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600';

const Toggle: React.FC<{
  enabled: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}> = ({ enabled, onChange, label, disabled = false }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    className={`relative shrink-0 w-12 h-7 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 outline-none ${
      enabled ? 'bg-teal-600' : 'bg-gray-300'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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

const SettingRow: React.FC<{
  title: string;
  description: string;
  badge?: string;
  first?: boolean;
  children: React.ReactNode;
}> = ({ title, description, badge, first = false, children }) => (
  <div className={`${first ? '' : 'border-t border-gray-100 pt-6'} flex items-center justify-between gap-4`}>
    <div className="min-w-0">
      <h3 className="font-medium text-gray-800 flex flex-wrap items-center gap-2">
        {title}
        {badge && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{badge}</span>
        )}
      </h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
    {children}
  </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-3 mb-6">
    {icon}
    <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
  </div>
);

const Field: React.FC<{ label: string; htmlFor: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
  <div>
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-2">
      {label}
    </label>
    {children}
  </div>
);

// Mirrors the ShiftType enum of the API.
const SHIFT_TYPES = ['DAY', 'EVENING', 'NIGHT', 'ON_CALL'] as const;

type EditableProfile = Pick<ProfileSettings, 'name' | 'department' | 'shift'>;

const ProfileForm: React.FC<{
  profile: ProfileSettings;
  onSave: (data: EditableProfile) => Promise<{ success: boolean }>;
}> = ({ profile, onSave }) => {
  const { t } = useTranslation();
  const uid = useId();
  const [form, setForm] = useState<EditableProfile>({
    name: profile.name,
    department: profile.department,
    shift: profile.shift,
  });
  const [saving, setSaving] = useState(false);

  const trimmed: EditableProfile = {
    name: form.name.trim(),
    department: form.department.trim(),
    shift: form.shift.trim(),
  };
  const valid = Object.values(trimmed).every((v) => v.length > 0);
  const changed = (Object.keys(trimmed) as (keyof EditableProfile)[]).some((k) => trimmed[k] !== profile[k]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !changed) return;
    setSaving(true);
    await onSave(trimmed);
    setSaving(false);
  };

  const bind = (key: keyof EditableProfile) => ({
    id: `${uid}-${key}`,
    value: form[key],
    required: true,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value })),
    className: INPUT_CLASS,
  });

  return (
    <form onSubmit={handleSubmit} className={FIELD_GRID}>
      <Field label={t('settings.profile.fullName')} htmlFor={`${uid}-name`}>
        <input type="text" maxLength={100} autoComplete="name" {...bind('name')} />
      </Field>
      <Field label={t('settings.profile.role')} htmlFor={`${uid}-role`}>
        <input id={`${uid}-role`} type="text" value={enumLabel(t, 'role', profile.role)} disabled className={READONLY_CLASS} />
      </Field>
      <Field label={t('settings.profile.email')} htmlFor={`${uid}-email`}>
        <input id={`${uid}-email`} type="email" value={profile.email} disabled className={READONLY_CLASS} />
      </Field>
      <Field label={t('settings.profile.department')} htmlFor={`${uid}-department`}>
        <input type="text" maxLength={100} {...bind('department')} />
      </Field>
      <Field label={t('settings.profile.shift')} htmlFor={`${uid}-shift`}>
        <select
          id={`${uid}-shift`}
          value={form.shift}
          required
          onChange={(e) => setForm((prev) => ({ ...prev, shift: e.target.value }))}
          className={INPUT_CLASS}
        >
          {SHIFT_TYPES.map((v) => (
            <option key={v} value={v}>{t(`staff.shifts.${v}`)}</option>
          ))}
        </select>
      </Field>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={saving || !valid || !changed}
          className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition"
        >
          {saving ? t('common.saving') : t('settings.profile.save')}
        </button>
      </div>
    </form>
  );
};

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
