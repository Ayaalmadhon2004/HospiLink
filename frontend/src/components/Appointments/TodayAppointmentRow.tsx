import { useTranslation } from 'react-i18next';
import { Stethoscope, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { Appointment } from '../../services/appointmentsService';
import { formatTime as fmtTime } from '../../utils/datetime';
import { enumLabel } from '../../utils/enumLabel';
import { typeColors, typeDotColors } from './appointmentStyles';

const formatTime = (dateStr: string) => {
  return fmtTime(dateStr, { hour: '2-digit', minute: '2-digit', hour12: false }, dateStr);
};

interface Props {
  apt: Appointment;
  onEdit: (apt: Appointment) => void;
  onDelete: (id: string, name: string) => void;
}

export const TodayAppointmentRow = ({ apt, onEdit, onDelete }: Props) => {
  const { t } = useTranslation();
  return (
    <div
      className={`group flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border-s-4 ${
        typeColors[apt.type] || 'bg-gray-50 border-gray-300'
      }`}
    >
      <div className="flex flex-col items-center min-w-[60px]">
        <span className="text-lg font-bold text-gray-900">
          {formatTime(apt.scheduledAt)}
        </span>
        <span className="text-xs text-gray-500">{t('appointments.minutes', { count: apt.duration })}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`w-2 h-2 rounded-full ${typeDotColors[apt.type] || 'bg-gray-400'}`} />
          <span className="font-medium text-gray-900">{apt.patient?.name || t('common.unknown')}</span>
          {apt.patient?.patientCode && (
            <span className="text-xs text-gray-400">{apt.patient.patientCode}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
          <span className="flex items-center gap-1">
            <Stethoscope size={14} />
            {enumLabel(t, 'appointmentType', apt.type)}
          </span>
          {apt.doctor?.name && (
            <span className="flex items-center gap-1">
              {apt.doctor.name.replace(/^Dr\.\s*/i, '')}
            </span>
          )}
          {apt.room && (
            <span className="flex items-center gap-1">
              <MapPin size={14} />
              {apt.room}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition">
        <button
          onClick={() => onEdit(apt)}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
          title={t('common.edit')}
          aria-label={t('common.edit')}
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => onDelete(apt.id, t('appointments.appointmentFor', { name: apt.patient?.name || t('common.unknown') }))}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          title={t('common.delete')}
          aria-label={t('common.delete')}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};
