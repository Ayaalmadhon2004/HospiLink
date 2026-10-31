import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../utils/logger';
import { getResponseData } from '../types/api';
import type { PatientDetail, PatientReport } from '../types/patient';
import { getPatientById, dischargePatient, getPatientReports } from '../services/patientService';

/** Patient record + discharge + reports list for the patient detail page. */
export const usePatientDetail = (id: string | undefined, reportsRefreshKey: boolean) => {
  const { t } = useTranslation();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [discharging, setDischarging] = useState(false);

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
  }, [id, reportsRefreshKey]); // Refresh when upload succeeds

  const handleDischarge = async (onDone: () => void) => {
    if (!id) return;
    setDischarging(true);
    try {
      await dischargePatient(id);
      onDone();
      const res = await getPatientById(id);
      setPatient(res.data);
    } catch (err: unknown) {
      setError(getResponseData(err)?.message || t('patientDetail.dischargeError'));
    } finally {
      setDischarging(false);
    }
  };

  return { patient, loading, error, setError, discharging, handleDischarge, reports, reportsLoading };
};
