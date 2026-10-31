// components/BedModal.tsx
import { useTranslation } from 'react-i18next';
import { Combobox } from './Form/Combobox';
import { BedStatusSelect } from './Beds/BedStatusSelect';
import { BedWardSelect } from './Beds/BedWardSelect';
import { useBedForm } from '../hooks/useBedForm';
import type { BedWithDetails, PatientOption } from "../types/bed";

export const BedModal = ({ bed, patients, onClose, onSuccess }: {
  bed: BedWithDetails | null;
  patients: PatientOption[];
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const { t } = useTranslation();
  const {
    bedNumber, setBedNumber, wardId, setWardId, setChosenStatus, selectedPatientId, setSelectedPatientId,
    status, wards, saving, toasts, showWardDropdown, setShowWardDropdown, showStatusDropdown, setShowStatusDropdown,
    modalRef, handleSubmit,
  } = useBedForm(bed, onClose, onSuccess);

  return (
    <div
      className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50 p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Toast notifications */}
      <div className="fixed top-4 end-4 z-[60] space-y-2" role="region" aria-label={t('common.notifications')}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
              toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
            }`}
            role="alert"
            aria-live="polite"
          >
            {toast.message}
          </div>
        ))}
      </div>

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bed-modal-title"
        className="bg-white rounded-xl p-6 w-full max-w-lg relative outline-none"
        tabIndex={-1}
      >
        <h2 id="bed-modal-title" className="text-xl font-bold text-gray-900 mb-1">
          {bed ? t('beds.modal.editTitle') : t('beds.modal.addTitle')}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {bed ? t('beds.modal.editSubtitle', { number: bed.bedNumber }) : t('beds.modal.addSubtitle')}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bed Number */}
          <div>
            <label htmlFor="bed-number" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('beds.modal.bedNumber')} <span className="text-red-600" aria-hidden="true">*</span>
              <span className="sr-only"> ({t('common.required')})</span>
            </label>
            <input
              id="bed-number"
              type="text"
              value={bedNumber}
              onChange={e => setBedNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              placeholder={t('beds.modal.bedNumberPlaceholder')}
              required
              aria-required="true"
            />
          </div>

          {/* Ward - Custom Dropdown */}
          <BedWardSelect
            wards={wards}
            wardId={wardId}
            open={showWardDropdown}
            onToggle={() => {
              setShowWardDropdown(!showWardDropdown);
              setShowStatusDropdown(false);
            }}
            onSelect={(id) => {
              setWardId(id);
              setShowWardDropdown(false);
            }}
          />

          {/* Patient - Custom Dropdown */}
          <div className="relative">
            <label id="patient-label" htmlFor="patient-select" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('beds.modal.assignPatient')}
            </label>
            <Combobox
              id="patient-select"
              options={patients.map((p) => ({ label: p.name, value: p.id, hint: p.patientCode }))}
              value={selectedPatientId}
              onChange={setSelectedPatientId}
              placeholder={t('beds.modal.unassigned')}
              clearLabel={t('beds.modal.unassigned')}
            />
            <p className="text-xs text-gray-500 mt-1" id="patient-hint">
              {selectedPatientId ? t('beds.modal.willBeOccupied') : t('beds.modal.willBeAvailable')}
            </p>
          </div>

          {/* Status - Custom Dropdown */}
          <BedStatusSelect
            status={status}
            hasPatient={!!selectedPatientId}
            open={showStatusDropdown}
            onToggle={() => {
              setShowStatusDropdown(!showStatusDropdown);
              setShowWardDropdown(false);
            }}
            onSelect={(s) => {
              setChosenStatus(s);
              setShowStatusDropdown(false);
            }}
          />

          {/* Buttons */}
          <div className="flex gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium text-sm"
              aria-label={t('common.cancelAndClose')}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !wardId}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium text-sm"
              aria-busy={saving}
            >
              {saving ? t('common.saving') : bed ? t('beds.modal.save') : t('beds.add')}
            </button>
          </div>
        </form>

        {/* Click outside to close dropdowns */}
        {(showWardDropdown || showStatusDropdown) && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-transparent border-none p-0 m-0 w-full h-full cursor-default"
            onClick={() => {
              setShowWardDropdown(false);
              setShowStatusDropdown(false);
            }}
            tabIndex={-1}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
};