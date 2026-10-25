import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadingSpinner } from './StatusBlocks';
import { appointmentDot } from '../../../utils/dashboardStats';
import { formatTime } from '../../../utils/datetime';
import type { Appointment } from '../../../services/appointmentsService';
import { enumLabel } from '../../../utils/enumLabel';

const VISIBLE_APPOINTMENTS = 5;

interface TodayScheduleSectionProps {
  loading: boolean;
  appointments: readonly Appointment[];
}

export const TodayScheduleSection = ({ loading, appointments }: TodayScheduleSectionProps) => {
  const { t } = useTranslation();
  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6" aria-labelledby="schedule-heading">
      <div className="flex justify-between items-center mb-4">
        <h2 id="schedule-heading" className="text-base font-semibold text-gray-900">{t('dashboard.todaysSchedule')}</h2>
        <Link
          to="/appointments"
          className="text-teal-600 text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-teal-500 rounded px-1"
          aria-label={t('dashboard.viewAllLabel')}
        >
          {t('dashboard.viewAll')}
        </Link>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : appointments.length > 0 ? (
        <ul className="divide-y divide-gray-100" aria-label={t('dashboard.todaysAppointments')}>
          {appointments.slice(0, VISIBLE_APPOINTMENTS).map((apt) => (
            <li key={apt.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${appointmentDot(apt.type)}`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{apt.patient?.name || t('common.unknown')}</p>
                <p className="text-xs text-gray-500">
                  {enumLabel(t, 'appointmentType', apt.type)} ·{' '}
                  {t('dashboard.doctorPrefix', { name: apt.doctor?.name || t('common.unknown') })}
                  {apt.room && ` · ${apt.room}`}
                </p>
              </div>
              <time className="text-xs font-medium text-gray-600 whitespace-nowrap" dateTime={apt.scheduledAt}>
                {formatTime(apt.scheduledAt, { hour: '2-digit', minute: '2-digit', hour12: true })}
              </time>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState message={t('dashboard.noAppointments')} />
      )}
    </section>
  );
};
