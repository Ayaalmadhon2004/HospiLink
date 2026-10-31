import { useTranslation } from 'react-i18next';
import { Users, MapPin, Clock, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { enumLabel } from '../../utils/enumLabel';
import type { Incident } from './incidentTypes';


const severityColors = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  ELEVATED: 'bg-amber-100 text-amber-700 border-amber-200',
  MODERATE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  LOW: 'bg-green-100 text-green-700 border-green-200',
};

const severityDots = {
  CRITICAL: 'bg-red-500',
  ELEVATED: 'bg-amber-500',
  MODERATE: 'bg-yellow-500',
  LOW: 'bg-green-500',
};

const statusColors = {
  ACTIVE: 'text-red-600 bg-red-50',
  RESOLVED: 'text-green-600 bg-green-50',
  PENDING: 'text-amber-600 bg-amber-50',
};

interface Props {
  incident: Incident;
  updating: boolean;
  timeAgo: (dateStr: string) => string;
  onStatusChange: (id: string, newStatus: string, progress?: number) => void;
  onEdit: (incident: Incident) => void;
  onDelete: (id: string, code: string) => void;
}

export const IncidentCard = ({ incident, updating, timeAgo, onStatusChange, onEdit, onDelete }: Props) => {
  const { t } = useTranslation();
  return (
    <div
      className="bg-white rounded-xl shadow-sm border p-6 group relative"
    >
      {/* Actions - hover */}
      <div className="absolute top-4 end-4 flex gap-2 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition">
        {/* ✅ NEW: Mark Resolved button */}
        {incident.status === 'ACTIVE' && (
          <button
            onClick={() =>
              onStatusChange(incident.id, 'RESOLVED', 100)
            }
            disabled={updating}
            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
            title={t('incidents.markResolved')}
            aria-label={t('incidents.markResolved')}
          >
            <CheckCircle2 size={16} />
          </button>
        )}
        <button
          onClick={() => onEdit(incident)}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
          title={t('incidents.edit')}
          aria-label={t('incidents.edit')}
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() =>
            onDelete(incident.id, incident.code)
          }
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          title={t('incidents.delete')}
          aria-label={t('incidents.delete')}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-3 pe-20">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-gray-500 font-mono">
            {incident.code}
          </span>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${severityColors[incident.severity]}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${severityDots[incident.severity]} inline-block me-1`}
            />
            {enumLabel(t, 'incidentSeverity', incident.severity)}
          </span>
          {/* ✅ Status badge */}
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[incident.status] || 'text-gray-600 bg-gray-50'}`}
          >
            {enumLabel(t, 'incidentStatus', incident.status)}
          </span>
        </div>
        <span className="text-sm text-gray-400">
          {timeAgo(incident.createdAt)}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-gray-900 mb-2">
        {incident.title}
      </h3>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4 flex-wrap">
        <span className="flex items-center gap-1">
          <MapPin size={14} />
          {incident.location}
        </span>
        <span className="flex items-center gap-1">
          <Users size={14} />
          {t('incidents.teams', { count: incident.teams })}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={14} />
          {timeAgo(incident.createdAt)}
        </span>
        {incident.reportedBy && (
          <span className="text-xs text-gray-400">
            {t('incidents.by', { name: incident.reportedBy })}
          </span>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t('incidents.triageProgress')}</span>
          <span className="font-semibold text-gray-900">
            {incident.progress}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              incident.progress >= 75
                ? 'bg-green-500'
                : incident.progress >= 50
                ? 'bg-amber-500'
                : incident.progress >= 25
                ? 'bg-orange-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${incident.progress}%` }}
          />
        </div>
      </div>

      {/* ✅ NEW: Progress slider for active incidents */}
      {incident.status === 'ACTIVE' && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{t('incidents.updateProgress')}</span>
            <input
              aria-label={t('incidents.updateProgress')}
              type="range"
              min="0"
              max="100"
              value={incident.progress}
              onChange={(e) =>
                onStatusChange(
                  incident.id,
                  incident.status,
                  Number(e.target.value)
                )
              }
              disabled={updating}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-hospital-navy"
            />
            <span className="text-xs font-medium text-gray-700 w-8">
              {incident.progress}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
