import { logger } from '../utils/logger';
import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost, apiPut } from '../services/api';
import { getErrorMessage, type ApiResponse } from '../types/api';
import type { BedStatus, BedWithDetails } from "../types/bed";

export interface BedToast {
  id: string;
  message: string;
  type: 'error' | 'success';
}

export interface BedWard {
  id: string;
  name: string;
}

/** Form state, ward lookup, toasts and submit handler of the bed modal. */
export const useBedForm = (bed: BedWithDetails | null, onClose: () => void, onSuccess: () => void) => {
  const { t } = useTranslation();
  const [bedNumber, setBedNumber] = useState(bed?.bedNumber || '');
  const [wardId, setWardId] = useState(bed?.wardId || '');
  const [chosenStatus, setChosenStatus] = useState<BedStatus>(bed?.status || 'AVAILABLE');
  const [selectedPatientId, setSelectedPatientId] = useState(bed?.patientId || '');
  // The server enforces OCCUPIED <=> has a patient: a patient makes the bed OCCUPIED, and without one it can only be
  // AVAILABLE, CLEANING or MAINTENANCE.
  const status: BedStatus = selectedPatientId ? 'OCCUPIED' : chosenStatus === 'OCCUPIED' ? 'AVAILABLE' : chosenStatus;
  const [wards, setWards] = useState<BedWard[]>([]);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<BedToast[]>([]);

  const [showWardDropdown, setShowWardDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  const addToast = useCallback((message: string, type: 'error' | 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(item => item.id !== id));
    }, 5000);
  }, []);

  // Fetch wards from API
  useEffect(() => {
    const fetchWards = async () => {
      try {
        const data = await apiGet<ApiResponse<BedWard[]>>('/wards');
        if (data.success) setWards(data.data);
      } catch {
        // Ward list stays empty on failure
      }
    };
    fetchWards();
  }, []);

  // Close dropdowns on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowWardDropdown(false);
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Focus trap
  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const body: Record<string, string> = {
        bedNumber,
        wardId,
        status,
      };

      if (selectedPatientId) {
        body.patientId = selectedPatientId;
      } else if (bed?.patientId) {
        // The patient was cleared in the form: tell the server to unassign them (otherwise the bed keeps its patient).
        body.patientId = '';
      }

      const data = bed
        ? await apiPut(`/beds/${bed.id}`, body)
        : await apiPost('/beds', body);

      if (data.success) {
        addToast(bed ? t('beds.modal.updated') : t('beds.modal.created'), 'success');
        onSuccess();
        onClose();
      } else {
        addToast(data.message || t('beds.modal.saveFailed'), 'error');
      }
    } catch (error: unknown) {
      logger.error('Error saving bed:', error);
      addToast(getErrorMessage(error, t('common.unexpectedError')), 'error');
    } finally {
      setSaving(false);
    }
  };

  return {
    bedNumber, setBedNumber, wardId, setWardId, setChosenStatus, selectedPatientId, setSelectedPatientId,
    status, wards, saving, toasts, showWardDropdown, setShowWardDropdown, showStatusDropdown, setShowStatusDropdown,
    modalRef, handleSubmit,
  };
};
