// frontend/src/components/Staff/StaffCard.tsx
import { Mail, Phone, Stethoscope, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Shift } from '../../types/staff';
import { formatTime } from '../../utils/datetime';
import { enumLabel } from '../../utils/enumLabel';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  hasLogin?: boolean;
  shifts?: Shift[];
}

interface StaffCardProps {
  member: StaffMember;
}

export const StaffCard = ({ member }: StaffCardProps) => {
  const { t } = useTranslation();
  const roleLabel = t(`staff.roles.${member.role}`, { defaultValue: member.role });
  const statusLabel = member.isActive ? t('staff.status.ACTIVE') : t('staff.status.INACTIVE');
  const currentShift = member.shifts?.[0];
  const initials = member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <article
      className={`bg-white rounded-2xl shadow-sm border p-5 transition-all hover:shadow-md ${member.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}
      aria-label={t('staff.card.label', { name: member.name, role: roleLabel })}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-medical-teal/10 flex items-center justify-center text-teal-700 font-bold text-lg flex-shrink-0 overflow-hidden">
          {member.avatar ? (
            <img
              src={member.avatar}
              alt={t('staff.card.photo', { name: member.name })}
              className="w-full h-full rounded-full object-cover"
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              width={48}
              height={48}
            />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-hospital-navy truncate">{member.name}</h3>
          <p className="text-sm text-clinic-text/60 flex items-center gap-1">
            <Stethoscope size={12} aria-hidden="true" />
            {roleLabel}
          </p>
          <p className="text-xs text-clinic-text/40 mt-0.5">{t(`departments.${member.department}`, { defaultValue: member.department })}</p>
        </div>

        {/* Status */}
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${member.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}
          role="status"
          aria-label={t('staff.card.status', { status: statusLabel })}
        >
          {statusLabel}
        </span>
        {member.hasLogin === false && (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800" title={t('staff.noLoginHint')}>
            {t('staff.noLogin')}
          </span>
        )}
      </div>

      {/* Contact Info */}
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
        <div className="flex items-center gap-2 text-sm text-clinic-text/60">
          <Mail size={14} aria-hidden="true" />
          <a
            href={`mailto:${member.email}`}
            className="truncate hover:text-medical-teal transition"
            aria-label={t('staff.card.email', { name: member.name, email: member.email })}
          >
            {member.email}
          </a>
        </div>
        {member.phone && (
          <div className="flex items-center gap-2 text-sm text-clinic-text/60">
            <Phone size={14} aria-hidden="true" />
            <a
              href={`tel:${member.phone}`}
              className="hover:text-medical-teal transition"
              aria-label={t('staff.card.call', { name: member.name, phone: member.phone })}
            >
              <bdi dir="ltr">{member.phone}</bdi>
            </a>
          </div>
        )}
      </div>

      {/* Current Shift */}
      {currentShift && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-sm">
            <Clock size={14} className="text-medical-teal" aria-hidden="true" />
            <span className="text-teal-700 font-medium">
              {enumLabel(t, 'shiftType', currentShift.type)}
            </span>
            <span className="text-clinic-text/40 text-xs">
              {formatTime(currentShift.startTime)} - 
              {formatTime(currentShift.endTime)}
            </span>
          </div>
        </div>
      )}
    </article>
  );
};