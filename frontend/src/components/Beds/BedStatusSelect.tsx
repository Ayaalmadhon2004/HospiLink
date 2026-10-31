import { useTranslation } from 'react-i18next';
import type { BedStatus } from '../../types/bed';

interface Props {
  status: BedStatus;
  hasPatient: boolean;
  open: boolean;
  onToggle: () => void;
  onSelect: (status: BedStatus) => void;
}

export const BedStatusSelect = ({ status, hasPatient, open: showStatusDropdown, onToggle, onSelect }: Props) => {
  const { t } = useTranslation();
  const selectedPatientId = hasPatient;
  const statusLabels: Record<BedStatus, string> = {
    AVAILABLE: t('beds.status.AVAILABLE'),
    OCCUPIED: t('beds.status.OCCUPIED'),
    CLEANING: t('beds.status.CLEANING'),
    MAINTENANCE: t('beds.status.MAINTENANCE'),
  };
  return (
    <div className="relative">
      <label id="status-label" className="block text-sm font-medium text-gray-700 mb-1.5">
        {t('beds.modal.status')}
      </label>
      <button
        type="button"
        id="status-select"
        aria-haspopup="listbox"
        aria-expanded={showStatusDropdown}
        aria-labelledby="status-label status-value"
        aria-describedby="status-hint"
        onClick={() => {
          if (!selectedPatientId) onToggle();
        }}
        disabled={!!selectedPatientId}
        className={`w-full border rounded-lg px-3 py-2.5 text-start outline-none text-sm flex justify-between items-center ${
          selectedPatientId
            ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
            : 'border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
        }`}
      >
        <span id="status-value" className={status ? 'text-gray-900' : 'text-gray-500'}>
          {statusLabels[status] || status}
        </span>
        {!selectedPatientId && (
          <svg
            className={`w-4 h-4 text-gray-500 transition ${showStatusDropdown ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {showStatusDropdown && !selectedPatientId && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg"
          role="listbox"
          aria-labelledby="status-label"
        >
          {(['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'] as BedStatus[]).map(s => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={status === s}
              onClick={() => onSelect(s)}
              className={`w-full text-start px-3 py-2.5 text-sm hover:bg-blue-50 transition ${
                status === s ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
              }`}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>
      )}
      {selectedPatientId && (
        <p className="text-xs text-gray-500 mt-1" id="status-hint">
          {t('beds.modal.autoStatus')}
        </p>
      )}
    </div>
  );
};
