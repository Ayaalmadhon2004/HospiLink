import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProfileSettings } from '../../hooks/useSettings';
import { enumLabel } from '../../utils/enumLabel';
import { Field } from './SettingsParts';
import { FIELD_GRID, INPUT_CLASS, READONLY_CLASS } from './settingsStyles';

// Mirrors the ShiftType enum of the API.
const SHIFT_TYPES = ['DAY', 'EVENING', 'NIGHT', 'ON_CALL'] as const;

type EditableProfile = Pick<ProfileSettings, 'name' | 'department' | 'shift'>;

export const ProfileForm: React.FC<{
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
