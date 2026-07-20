import { useQuery } from '@tanstack/react-query';
import { getPatients } from '../services/patientService';

interface UsePatientsParams {
  status?: string;
  department?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const usePatients = (params: UsePatientsParams = {}) => {
  const { status, department, search, page = 1, limit = 10 } = params;

  const { data, isLoading, error, refetch, isFetching, isPlaceholderData } = useQuery({
    queryKey: ['patients', status, department, search, page, limit],
    queryFn: () => getPatients({
      status: status === 'All' ? undefined : status,
      department: department === 'All' ? undefined : department,
      search: search || undefined,
      page: String(page),
      limit: String(limit),
    }),
    placeholderData: (previousData) => previousData, // keepPreviousData
    staleTime: 1000 * 30, // 30 seconds
  });

  return {
    patients: data?.data || [],
    pagination: data?.pagination || null,
    loading: isLoading,
    isFetching,
    isPlaceholderData,
    error: error?.message || '',
    refetch,
  };
};