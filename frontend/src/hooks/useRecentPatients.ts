import { useState, useEffect } from 'react';
import { getRecentPatients } from '../services/patientService';
import type { RecentPatient } from '../types/patient';
import { getErrorMessage } from '../types/api';

export const useRecentPatients = () => {
  const [patients, setPatients] = useState<RecentPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getRecentPatients();
        setPatients(res.data);
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return { patients, loading, error };
};