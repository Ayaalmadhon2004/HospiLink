import { useState, useEffect } from 'react';
import { getRecentPatients } from '../services/patientService';

export const useRecentPatients = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const res = await getRecentPatients(token);
        setPatients(res.data);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return { patients, loading, error };
};