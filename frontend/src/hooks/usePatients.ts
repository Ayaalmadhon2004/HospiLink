import { useQuery } from '@tanstack/react-query';
import { getPatients } from '../services/patientService';

interface UsePatientsParams {
  status?: string;
  department?: string;
  search?: string;
}

export const usePatients = (params: UsePatientsParams = {}) => {
  const { status, department, search } = params;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['patients', status, department, search],
    queryFn: () => getPatients({
      status: status === 'All' ? undefined : status,
      department: department === 'All' ? undefined : department,
      search: search || undefined,
    }),
  });

  return {
    patients: data?.data || [],
    loading: isLoading,
    error: error?.message || '',
    refetch,
  };
};