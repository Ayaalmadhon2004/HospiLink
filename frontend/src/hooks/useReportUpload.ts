import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getResponseData } from '../types/api';
import { uploadReport } from '../services/patientService';
import { isReportFileTooLarge } from '../utils/reportFile';

/** File selection + upload state for the patient report upload modal. */
export const useReportUpload = (id: string | undefined) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  return {
    fileInputRef, showUploadModal, setShowUploadModal, uploading, uploadError, uploadSuccess,
    selectedFile, handleFileSelect, handleUpload, closeUploadModal,
  };
};
