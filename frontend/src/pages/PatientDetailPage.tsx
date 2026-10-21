import { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { api } from '../services/api';
import { getResponseData } from '../types/api';
import type { PatientDetail, PatientReport } from '../types/patient';
import { getPatientById, dischargePatient, uploadReport, getPatientReports } from '../services/patientService';
import { isReportFileTooLarge } from '../utils/reportFile';
import { ArrowLeft, User, Bed, Stethoscope, Activity, LogOut, Upload, FileText, X, CheckCircle, Download } from 'lucide-react';
import { formatDate } from '../utils/datetime';

const STATUS_COLORS = {
  STABLE: 'bg-green-100 text-green-700',
  OBSERVATION: 'bg-yellow-100 text-yellow-700',
  CRITICAL: 'bg-red-100 text-red-700',
  DISCHARGED: 'bg-gray-100 text-gray-500',
};

// /uploads is protected: fetch the file with auth (Bearer/cookie) and open it as a blob URL
const openReportFile = async (fileUrl: string): Promise<void> => {
  const base = String(api.defaults.baseURL ?? '').replace(/\/api\/?$/, '');
  const res = await api.get(`${base}${fileUrl}`, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(res.data as Blob);
  window.open(blobUrl, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};

export const PatientDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [discharging, setDischarging] = useState(false);

  // Upload states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Reports state
  const [reports, setReports] = useState<PatientReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    const fetchPatient = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await getPatientById(id);
        setPatient(res.data);
      } catch (err: unknown) {
        setError(getResponseData(err)?.message || t('patientDetail.loadError'));
      } finally {
        setLoading(false);
      }
    };
    fetchPatient();
  }, [id, t]);

  // Fetch reports
  useEffect(() => {
    const fetchReports = async () => {
      if (!id) return;
      try {
        setReportsLoading(true);
        const res = await getPatientReports(id);
        setReports(res.data || []);
      } catch (err: unknown) {
        logger.error('Failed to fetch reports:', err);
      } finally {
        setReportsLoading(false);
      }
    };
    fetchReports();
  }, [id, uploadSuccess]); // Refresh when upload succeeds

  const handleDischarge = async () => {
    if (!id) return;
    setDischarging(true);
    try {
      await dischargePatient(id);
      setShowDischargeModal(false);
      const res = await getPatientById(id);
      setPatient(res.data);
    } catch (err: unknown) {
      setError(getResponseData(err)?.message || t('patientDetail.dischargeError'));
    } finally {
      setDischarging(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        setUploadError(t('patientDetail.invalidFileType'));
        return;
      }
      if (isReportFileTooLarge(file.size)) {
        setUploadError(t('patientDetail.fileTooLarge'));
        return;
      }
      setSelectedFile(file);
      setUploadError('');
      setUploadSuccess(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !id) return;

    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    try {
      await uploadReport(selectedFile, id);
      setUploadSuccess(true);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setTimeout(() => {
        setUploadSuccess(false);
        setShowUploadModal(false);
      }, 3000);
    } catch (err: unknown) {
      setUploadError(getResponseData(err)?.message || t('patientDetail.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setSelectedFile(null);
    setUploadError('');
    setUploadSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
              aria-label={t('patients.statusAria', { status: t(`status.${patient.status}`, { defaultValue: patient.status }) })}
            >
              {t(`status.${patient.status}`, { defaultValue: patient.status })}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Personal Info */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
              <User size={20} className="text-medical-teal" aria-hidden="true" />
              {t('patientDetail.personalInfo')}
            </h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-clinic-text/50">{t('patientDetail.age')}</dt>
                <dd className="font-medium text-clinic-text">{t('patientDetail.years', { count: patient.age })}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-clinic-text/50">{t('patientDetail.gender')}</dt>
                <dd className="font-medium text-clinic-text">{t(`gender.${patient.gender}`, { defaultValue: patient.gender })}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-clinic-text/50">{t('patientDetail.admissionDate')}</dt>
                <dd className="font-medium text-clinic-text">
                  <time dateTime={patient.admissionDate}>
                    {formatDate(patient.admissionDate)}
                  </time>
                </dd>
              </div>
              {patient.dischargeDate && (
                <div className="flex justify-between">
                  <dt className="text-clinic-text/50">{t('patientDetail.dischargeDate')}</dt>
                  <dd className="font-medium text-medical-teal">
                    <time dateTime={patient.dischargeDate}>
                      {formatDate(patient.dischargeDate)}
                    </time>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Medical Info */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
              <Stethoscope size={20} className="text-red-500" aria-hidden="true" />
              {t('patientDetail.medicalInfo')}
            </h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-clinic-text/50">{t('patientDetail.department')}</dt>
                <dd className="font-medium text-clinic-text">{t(`departments.${patient.department}`, { defaultValue: patient.department })}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-clinic-text/50">{t('patientDetail.diagnosis')}</dt>
                <dd className="font-medium text-clinic-text">{patient.diagnosis}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-clinic-text/50">{t('patientDetail.attendingPhysician')}</dt>
                <dd className="font-medium text-clinic-text">{patient.doctor?.name || t('patientDetail.notAssigned')}</dd>
              </div>
            </dl>
          </section>

          {/* Bed Info */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
              <Bed size={20} className="text-medical-teal" aria-hidden="true" />
              {t('patientDetail.bedInfo')}
            </h2>
            {patient.bed ? (
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-clinic-text/50">{t('patientDetail.bedNumber')}</dt>
                  <dd className="font-medium text-clinic-text">{patient.bed.bedNumber}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-clinic-text/50">{t('patientDetail.ward')}</dt>
                  <dd className="font-medium text-clinic-text">{patient.bed.wardName}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-clinic-text/40">{t('patientDetail.noBed')}</p>
            )}
          </section>

          {/* Vitals */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
              <Activity size={20} className="text-purple-500" aria-hidden="true" />
              {t('patientDetail.vitals')}
            </h2>
            <p className="text-clinic-text/40 text-sm">{t('patientDetail.vitalsSoon')}</p>
          </section>
        </div>

        {/* Reports Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-bold text-hospital-navy mb-4 flex items-center gap-2">
            <FileText size={20} className="text-medical-teal" aria-hidden="true" />
            {t('patientDetail.reports', { count: reports.length })}
          </h2>

          {reportsLoading ? (
            <div className="text-clinic-text/40 text-sm">{t('patientDetail.loadingReports')}</div>
          ) : reports.length === 0 ? (
            <p className="text-clinic-text/40 text-sm">{t('patientDetail.noReports')}</p>
          ) : (
            <ul className="space-y-2" role="list" aria-label={t('patientDetail.reportsLabel')}>
              {reports.map((report) => (
                <li key={report.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                  <FileText size={16} className="text-medical-teal" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-clinic-text truncate">{report.fileName}</p>
                    <p className="text-xs text-clinic-text/40">
                      <time dateTime={report.createdAt}>
                        {formatDate(report.createdAt)}
                      </time>
                      {' • '}
                      {report.fileType.split('/')[1].toUpperCase()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { openReportFile(report.fileUrl).catch(() => setError(t('patientDetail.openReportError'))); }}
                    className="text-medical-teal hover:underline text-sm flex items-center gap-1"
                    aria-label={t('patientDetail.viewReport', { name: report.fileName })}
                  >
                    <Download size={14} aria-hidden="true" />
                    {t('patientDetail.view')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => navigate(`/patients/${id}/edit`)}
            className="bg-hospital-navy text-white px-6 py-3 rounded-xl hover:bg-hospital-navy/90 transition"
          >
            {t('patientDetail.edit')}
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
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

      {/* Discharge Confirmation Modal */}
      {showDischargeModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discharge-title"
        >
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
            <h2 id="discharge-title" className="text-xl font-bold text-hospital-navy mb-2">{t('patientDetail.confirmDischarge')}</h2>
            <p className="text-clinic-text/50 mb-6">
              <Trans
                i18nKey="patientDetail.dischargeQuestion"
                values={{ name: patient.name }}
                components={{ strong: <strong className="text-clinic-text" /> }}
              />
            </p>
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm" role="alert">{error}</div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDischargeModal(false)}
                className="bg-slate-100 text-clinic-text px-4 py-2 rounded-xl hover:bg-slate-200 transition"
                disabled={discharging}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDischarge}
                className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 transition disabled:opacity-50"
                disabled={discharging}
                aria-busy={discharging}
              >
                {discharging ? t('patientDetail.discharging') : t('patientDetail.confirmDischarge')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Report Modal */}
      {showUploadModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-title"
        >
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 id="upload-title" className="text-xl font-bold text-hospital-navy">{t('patientDetail.uploadReport')}</h2>
              <button 
                onClick={closeUploadModal} 
                className="text-clinic-text/50 hover:text-clinic-text"
                aria-label={t('patientDetail.closeUpload')}
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-clinic-text/50 mb-4">
              {t('patientDetail.uploadPrompt', { name: patient.name })}
            </p>

            {/* File Input Area */}
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center mb-4 hover:border-medical-teal transition">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                aria-describedby="file-help"
              />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload size={32} className="text-medical-teal" aria-hidden="true" />
                <span className="text-clinic-text/70">
                  {selectedFile ? selectedFile.name : t('patientDetail.selectFile')}
                </span>
                <span id="file-help" className="text-xs text-clinic-text/40">{t('patientDetail.fileHelp')}</span>
              </label>
            </div>

            {/* Selected File Info */}
            {selectedFile && (
              <div className="bg-medical-teal/5 border border-medical-teal/20 rounded-lg p-3 mb-4 flex items-center gap-2">
                <FileText size={16} className="text-medical-teal" aria-hidden="true" />
                <span className="text-sm text-clinic-text">{selectedFile.name}</span>
                <span className="text-xs text-clinic-text/40 ms-auto">
                  {t('patientDetail.sizeMb', { size: (selectedFile.size / 1024 / 1024).toFixed(2) })}
                </span>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div 
                className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm"
                role="alert"
                aria-live="assertive"
              >
                {uploadError}
              </div>
            )}

            {/* Success Message */}
            {uploadSuccess && (
              <div 
                className="bg-green-50 text-green-600 px-4 py-3 rounded-xl mb-4 text-sm flex items-center gap-2"
                role="alert"
                aria-live="polite"
              >
                <CheckCircle size={16} aria-hidden="true" />
                {t('patientDetail.uploadSuccess')}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={closeUploadModal}
                className="bg-slate-100 text-clinic-text px-4 py-2 rounded-xl hover:bg-slate-200 transition"
                disabled={uploading}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleUpload}
                className="bg-medical-teal text-white px-4 py-2 rounded-xl hover:bg-medical-teal/90 transition disabled:opacity-50 flex items-center gap-2"
                disabled={!selectedFile || uploading}
                aria-busy={uploading}
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                    {t('patientDetail.uploading')}
                  </>
                ) : (
                  <>
                    <Upload size={16} aria-hidden="true" />
                    {t('patientDetail.upload')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};