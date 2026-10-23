import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadReport } from '../services/patientService';
import { Upload, X, FileText, Image } from 'lucide-react';

interface UploadReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
}

export const UploadReportModal = ({ isOpen, onClose, patientId }: UploadReportModalProps) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => uploadReport(file, patientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      setSelectedFile(null);
      setPreview(null);
      onClose();
    },
  });

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    mutation.mutate(selectedFile);
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload size={48} className="text-clinic-text/30" aria-hidden="true" />;
    if (selectedFile.type.startsWith('image/')) return <Image size={48} className="text-medical-teal" aria-hidden="true" />;
    return <FileText size={48} className="text-hospital-navy" aria-hidden="true" />;
  };

  return (
    <div
      className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 id="upload-modal-title" className="text-xl font-bold text-hospital-navy">
            {t('patientDetail.uploadReport')}
          </h2>
          <button
            onClick={onClose}
            className="text-clinic-text/50 hover:text-clinic-text p-1 rounded-lg hover:bg-slate-100 transition"
            aria-label={t('patientDetail.closeUpload')}
            type="button"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {mutation.isError && (
          <div
            className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm"
            role="alert"
            aria-live="assertive"
          >
            {mutation.error?.message || t('uploadReport.failed')}
          </div>
        )}

        {/* Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={t('uploadReport.dropLabel')}
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-medical-teal transition"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileSelect}
            className="hidden"
            aria-label={t('uploadReport.inputLabel')}
          />

          {preview ? (
            <img
              src={preview}
              alt={t('uploadReport.preview', { name: selectedFile?.name || t('uploadReport.selectedFile') })}
              className="max-h-40 mx-auto rounded-lg"
              loading="lazy"
              decoding="async"
              fetchPriority="low"
            />
          ) : (
            <div className="flex flex-col items-center gap-2">
              {getFileIcon()}
              <p className="text-clinic-text/70">
                {selectedFile ? selectedFile.name : t('uploadReport.select')}
              </p>
              <p className="text-clinic-text/40 text-sm">
                {t('uploadReport.help')}
              </p>
            </div>
          )}
        </div>

        {/* File Info */}
        {selectedFile && (
          <div className="mt-4 p-3 bg-slate-50 rounded-xl">
            <div className="flex justify-between items-center">
              <span className="text-sm text-clinic-text truncate">{selectedFile.name}</span>
              <span className="text-xs text-clinic-text/50">
                {t('patientDetail.sizeMb', { size: (selectedFile.size / 1024 / 1024).toFixed(2) })}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-100 text-clinic-text py-3 rounded-xl hover:bg-slate-200 transition"
            disabled={mutation.isPending}
            type="button"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || mutation.isPending}
            className="flex-1 bg-hospital-navy text-white py-3 rounded-xl hover:bg-hospital-navy/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            aria-busy={mutation.isPending}
            type="button"
          >
            <Upload size={18} aria-hidden="true" />
            {mutation.isPending ? t('patientDetail.uploading') : t('patientDetail.uploadReport')}
          </button>
        </div>
      </div>
    </div>
  );
};