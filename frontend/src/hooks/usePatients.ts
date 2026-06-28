import { useState, useEffect } from 'react';
import { getPatients } from '../services/patientService';

export const usePatients = (filters?: { status?: string; department?: string; search?: string }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        const res = await getPatients(filters);
        setPatients(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'فشل جلب المرضى');
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [filters?.status, filters?.department, filters?.search]);

  return { patients, loading, error };
};