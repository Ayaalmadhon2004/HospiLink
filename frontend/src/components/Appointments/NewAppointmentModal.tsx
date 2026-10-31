// frontend/src/components/Appointments/NewAppointmentModal.tsx
import { useTranslation } from 'react-i18next';
import { X, Clock, Stethoscope, MapPin, FileText } from 'lucide-react';
import type { AppointmentFormOptions } from '../../hooks/useAppointmentForm';
import { useAppointmentForm } from '../../hooks/useAppointmentForm';
import { AppointmentPatientPicker } from './AppointmentPatientPicker';

interface NewAppointmentModalProps extends AppointmentFormOptions {
  isOpen: boolean;
}


const APPOINTMENT_TYPES = [
  { value: 'CONSULTATION', label: 'Consultation', color: 'bg-teal-100 text-teal-700' },
  { value: 'SURGERY', label: 'Surgery', color: 'bg-red-100 text-red-700' },
  { value: 'IMAGING', label: 'Imaging', color: 'bg-blue-100 text-blue-700' },
  { value: 'FOLLOW_UP', label: 'Follow-up', color: 'bg-amber-100 text-amber-700' },
  { value: 'LAB_TEST', label: 'Lab Test', color: 'bg-purple-100 text-purple-700' },
];

const DEPARTMENTS = [
  'General',
  'Cardiology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'Emergency',
  'Radiology',
  'Surgery',
];

const AppointmentForm = ({ onClose, onSuccess, editingAppointment }: Omit<NewAppointmentModalProps, 'isOpen'>) => {
  const { t } = useTranslation();
  const {
    patients, doctors, loading, fetchingPatients, selectedPatient, patientSearch,
    doctorId, setDoctorId, scheduledAt, setScheduledAt, type, setType,
    department, setDepartment, room, setRoom, notes, setNotes, duration, setDuration,
    isEditing, handleSelectPatient, handlePatientInputChange, clearPatient, handleSubmit,
  } = useAppointmentForm({ onClose, onSuccess, editingAppointment });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-hospital-navy/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? t('appointments.modal.editTitle') : t('appointments.new')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label={t('common.close')}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* ─── Patient Search ────────────────────────── */}
          <AppointmentPatientPicker
            patients={patients}
            selectedPatient={selectedPatient}
            patientSearch={patientSearch}
            fetchingPatients={fetchingPatients}
            onSelect={handleSelectPatient}
            onInputChange={handlePatientInputChange}
            onClear={clearPatient}
          />


          {/* ─── Doctor ────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointments.modal.doctor')} *
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              required
            >
              <option value="">{t('appointments.modal.selectDoctor')}</option>
              {doctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {t('dashboard.doctorPrefix', { name: doc.name.replace(/^Dr\.\s*/i, '') })} — {doc.department || doc.role}
                </option>
              ))}
            </select>
          </div>

          {/* ─── Date & Time ───────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock size={14} className="inline me-1" />
              {t('appointments.modal.dateTime')} *
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              required
            />
          </div>

          {/* ─── Type ──────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Stethoscope size={14} className="inline me-1" />
              {t('appointments.modal.type')} *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {APPOINTMENT_TYPES.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={type === opt.value}
                  onClick={() => setType(opt.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition border ${
                    type === opt.value
                      ? opt.color + ' border-current ring-2 ring-offset-1 ring-current'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {t(`appointments.types.${opt.value}`, { defaultValue: opt.label })}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Department & Room ─────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('appointments.modal.department')}
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{t(`departments.${dept}`, { defaultValue: dept })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin size={14} className="inline me-1" />
                {t('appointments.modal.room')}
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder={t('appointments.modal.roomPlaceholder')}
                className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>
          </div>

          {/* ─── Duration ──────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('appointments.modal.duration')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="15"
                max="120"
                step="15"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="flex-1"
              />
              <span className="min-w-[60px] text-end font-medium text-gray-900">
                {t('appointments.minutes', { count: duration })}
              </span>
            </div>
          </div>

          {/* ─── Notes ─────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText size={14} className="inline me-1" />
              {t('appointments.modal.notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={t('appointments.modal.notesPlaceholder')}
              className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 outline-none resize-none"
            />
          </div>

          {/* ─── Actions ───────────────────────────────── */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border rounded-lg hover:bg-gray-50 transition text-gray-700"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? t('common.saving') : isEditing ? t('appointments.modal.update') : t('appointments.modal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** Mounts the form only while open (one instance per appointment), so every opening starts from fresh state. */
export const NewAppointmentModal = ({ isOpen, ...formProps }: NewAppointmentModalProps) =>
  isOpen ? <AppointmentForm key={formProps.editingAppointment?.id ?? 'new'} {...formProps} /> : null;
