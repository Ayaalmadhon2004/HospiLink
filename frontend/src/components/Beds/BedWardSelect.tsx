import { useTranslation } from 'react-i18next';
import type { BedWard } from '../../hooks/useBedForm';

interface Props {
  wards: BedWard[];
  wardId: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}

export const BedWardSelect = ({ wards, wardId, open: showWardDropdown, onToggle, onSelect }: Props) => {
  const { t } = useTranslation();
  const selectedWard = wards.find(w => w.id === wardId);
  return (
    <div className="relative">
      <label id="ward-label" className="block text-sm font-medium text-gray-700 mb-1.5">
        {t('beds.modal.ward')} <span className="text-red-600" aria-hidden="true">*</span>
        <span className="sr-only"> ({t('common.required')})</span>
      </label>
      <button
        type="button"
        id="ward-select"
        aria-haspopup="listbox"
        aria-expanded={showWardDropdown}
        aria-labelledby="ward-label ward-value"
        onClick={onToggle}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-start focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white flex justify-between items-center"
      >
        <span id="ward-value" className={selectedWard ? 'text-gray-900' : 'text-gray-500'}>
          {selectedWard ? selectedWard.name : t('beds.modal.selectWard')}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition ${showWardDropdown ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showWardDropdown && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          role="listbox"
          aria-labelledby="ward-label"
        >
          {wards.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">{t('beds.modal.noWards')}</div>
          ) : (
            wards.map(w => (
              <button
                key={w.id}
                type="button"
                role="option"
                aria-selected={wardId === w.id}
                onClick={() => onSelect(w.id)}
                className={`w-full text-start px-3 py-2.5 text-sm hover:bg-blue-50 transition ${
                  wardId === w.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                {w.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
