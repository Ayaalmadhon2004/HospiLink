import { useTranslation } from 'react-i18next';
import type { RefObject } from 'react';
import { Upload, FileText, X, CheckCircle } from 'lucide-react';

interface Props {
  patientName: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  selectedFile: File | null;
  uploading: boolean;
  uploadError: string;
  uploadSuccess: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onClose: () => void;
}

export const ReportUploadModal = ({
  patientName, fileInputRef, selectedFile, uploading, uploadError, uploadSuccess, onFileSelect, onUpload, onClose,
}: Props) => {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-title"
    >
      <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 id="upload-title" className="text-xl font-bold text-hospital-navy">{t('patientDetail.uploadReport')}</h2>
          <button
            onClick={onClose}
            className="text-clinic-text/50 hover:text-clinic-text"
            aria-label={t('patientDetail.closeUpload')}
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-clinic-text/50 mb-4">
          {t('patientDetail.uploadPrompt', { name: patientName })}
        </p>

        {/* File Input Area */}
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center mb-4 hover:border-medical-teal transition">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={onFileSelect}
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
            onClick={onClose}
            className="bg-slate-100 text-clinic-text px-4 py-2 rounded-xl hover:bg-slate-200 transition"
            disabled={uploading}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onUpload}
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
  );
};
