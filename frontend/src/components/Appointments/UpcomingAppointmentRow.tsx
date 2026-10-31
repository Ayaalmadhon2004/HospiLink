import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import type { Appointment } from '../../services/appointmentsService';
import { formatDate as fmtDate, formatTime as fmtTime } from '../../utils/datetime';
import { enumLabel } from '../../utils/enumLabel';
import { typeColors, typeDotColors } from './appointmentStyles';

const formatTime = (dateStr: string) => {
  return fmtTime(dateStr, { hour: '2-digit', minute: '2-digit', hour12: false }, dateStr);
};

const formatDate = (dateStr: string) => {
  return fmtDate(dateStr, { month: 'short', day: 'numeric' });
};

interface Props {
  apt: Appointment;
  onEdit: (apt: Appointment) => void;
  onDelete: (id: string, name: string) => void;
}

export const UpcomingAppointmentRow = ({ apt, onEdit, onDelete }: Props) => {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border hover:bg-gray-50 transition group"
    >
      <div className="flex flex-col items-center min-w-[60px] bg-gray-100 rounded-lg p-2">
        <span className="text-xs text-gray-500">{formatDate(apt.scheduledAt)}</span>
        <span className="text-sm font-bold text-gray-900">
          {formatTime(apt.scheduledAt)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`w-2 h-2 rounded-full ${typeDotColors[apt.type] || 'bg-gray-400'}`} />
          <span className="font-medium text-gray-900">{apt.patient?.name || t('common.unknown')}</span>
          {apt.patient?.patientCode && (
            <span className="text-xs text-gray-500">{apt.patient.patientCode}</span>
          )}
        </div>
        <div className="text-sm text-gray-500 mt-1">
          {enumLabel(t, 'appointmentType', apt.type)} &middot; {apt.doctor?.name ? apt.doctor.name.replace(/^Dr\.\s*/i, '') : t('appointments.noDoctor')} &middot; {t(`departments.${apt.department}`, { defaultValue: apt.department })}
        </div>
      </div>
      <span className={`hidden sm:inline-block px-2 py-1 rounded-full text-xs font-medium ${typeColors[apt.type] || ''}`}>
        {enumLabel(t, 'appointmentType', apt.type)}
      </span>
      <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          onClick={() => onEdit(apt)}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
          title={t('common.edit')}
          aria-label={t('common.edit')}
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onDelete(apt.id, t('appointments.appointmentFor', { name: apt.patient?.name || t('common.unknown') }))}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          title={t('common.delete')}
          aria-label={t('common.delete')}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};
