import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, User, LogOut, Upload } from 'lucide-react';
import { ClinicalRecords } from '../components/Clinical/ClinicalRecords';
import { DischargeModal } from '../components/PatientDetail/DischargeModal';
import { PatientInfoGrid } from '../components/PatientDetail/PatientInfoGrid';
import { ReportUploadModal } from '../components/PatientDetail/ReportUploadModal';
import { ReportsSection } from '../components/PatientDetail/ReportsSection';
import { useAuthPermissions } from '../hooks/useAuthPermissions';
import { usePatientDetail } from '../hooks/usePatientDetail';
import { useReportUpload } from '../hooks/useReportUpload';
import { enumLabel } from '../utils/enumLabel';

const STATUS_COLORS = {
  STABLE: 'bg-green-100 text-green-700',
  OBSERVATION: 'bg-yellow-100 text-yellow-700',
  CRITICAL: 'bg-red-100 text-red-700',
  DISCHARGED: 'bg-gray-100 text-gray-500',
};

export const PatientDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = useAuthPermissions();

  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const upload = useReportUpload(id);
  const { patient, loading, error, setError, discharging, handleDischarge, reports, reportsLoading } =
    usePatientDetail(id, upload.uploadSuccess);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="text-clinic-text/50">{t('common.loading')}</div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinic-bg">
        <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl">
          {error || t('patientDetail.notFound')}
          <button onClick={() => navigate('/dashboard')} className="block mt-4 text-hospital-navy hover:underline">
            {t('patientDetail.backToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clinic-bg p-4 md:p-8">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-clinic-text/70 hover:text-clinic-text mb-6 transition"
        aria-label={t('common.goBack')}
      >
        <ArrowLeft size={20} className="rtl:rotate-180" aria-hidden="true" />
        {t('common.back')}
      </button>

      <div className="max-w-4xl mx-auto">
        {/* Patient Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 bg-hospital-navy/10 rounded-full flex items-center justify-center"
                aria-hidden="true"
              >
                <User size={32} className="text-hospital-navy" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-hospital-navy">{patient.name}</h1>
                <p className="text-clinic-text/50">{patient.patientCode}</p>
              </div>
            </div>
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${STATUS_COLORS[patient.status as keyof typeof STATUS_COLORS]}`}
              role="status"
              aria-label={t('patients.statusAria', { status: enumLabel(t, 'patientStatus', patient.status) })}
            >
              {enumLabel(t, 'patientStatus', patient.status)}
            </span>
          </div>
        </div>

        <PatientInfoGrid patient={patient} />

        <ReportsSection reports={reports} loading={reportsLoading} onOpenError={setError} />

        {can('clinical:read') && id && <ClinicalRecords patientId={id} />}

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => navigate(`/patients/${id}/edit`)}
            className="bg-hospital-navy text-white px-6 py-3 rounded-xl hover:bg-hospital-navy/90 transition"
          >
            {t('patientDetail.edit')}
          </button>

          <button
            onClick={() => upload.setShowUploadModal(true)}
            className="bg-medical-teal/10 text-medical-teal border border-medical-teal/20 px-6 py-3 rounded-xl hover:bg-medical-teal/20 transition flex items-center gap-2"
          >
            <Upload size={18} aria-hidden="true" />
            {t('patientDetail.uploadReport')}
          </button>

          {patient.status !== 'DISCHARGED' && (
            <button
              onClick={() => setShowDischargeModal(true)}
              className="bg-red-50 text-red-600 border border-red-200 px-6 py-3 rounded-xl hover:bg-red-100 transition flex items-center gap-2"
            >
              <LogOut size={18} aria-hidden="true" />
              {t('patientDetail.discharge')}
            </button>
          )}
        </div>
      </div>

      {showDischargeModal && (
        <DischargeModal
          patientName={patient.name}
          error={error}
          discharging={discharging}
          onCancel={() => setShowDischargeModal(false)}
          onConfirm={() => handleDischarge(() => setShowDischargeModal(false))}
        />
      )}

      {upload.showUploadModal && (
        <ReportUploadModal
          patientName={patient.name}
          fileInputRef={upload.fileInputRef}
          selectedFile={upload.selectedFile}
          uploading={upload.uploading}
          uploadError={upload.uploadError}
          uploadSuccess={upload.uploadSuccess}
          onFileSelect={upload.handleFileSelect}
          onUpload={upload.handleUpload}
          onClose={upload.closeUploadModal}
        />
      )}
    </div>
  );
};
