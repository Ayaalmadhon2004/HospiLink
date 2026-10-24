import { useQuery } from '@tanstack/react-query';
import { getRecentPatients } from '../services/patientService';
import { getTodaySchedule, type Appointment } from '../services/appointmentsService';
import { getStaff } from '../services/staffService';
import { getBeds } from '../services/bedService';
import { bedOccupancy, buildDepartmentLoads, type DepartmentLoad } from '../utils/dashboardStats';
import type { RecentPatient } from '../types/patient';

const POLLING_INTERVAL = 30_000;

export interface DashboardOverview {
  patients: RecentPatient[];
  todaySchedule: Appointment[];
  staffCount: number;
  bedOccupancy: number;
  totalBeds: number;
  occupiedBeds: number;
  departmentLoads: DepartmentLoad[];
}

const EMPTY_OVERVIEW: DashboardOverview = {
  patients: [],
  todaySchedule: [],
  staffCount: 0,
  bedOccupancy: 0,
  totalBeds: 0,
  occupiedBeds: 0,
  departmentLoads: [],
};

const fetchOverview = async (): Promise<DashboardOverview> => {
  const [patientsRes, scheduleRes, staffRes, bedsRes] = await Promise.all([
    getRecentPatients(),
    getTodaySchedule(),
    getStaff(),
    getBeds(),
  ]);

  const patients = patientsRes.data ?? [];
  const beds = bedsRes.data ?? [];
  const occupiedBeds = beds.filter((bed) => bed.status === 'OCCUPIED').length;

  return {
    patients,
    todaySchedule: scheduleRes.data?.appointments ?? [],
    staffCount: (staffRes.data ?? []).length,
    bedOccupancy: bedOccupancy(occupiedBeds, beds.length),
    totalBeds: beds.length,
    occupiedBeds,
    departmentLoads: buildDepartmentLoads(patients),
  };
};

/** Numbers of the overview page, refreshed every 30 s while the page is open. */
export const useDashboardData = () => {
  const query = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: fetchOverview,
    refetchInterval: POLLING_INTERVAL,
  });

  return {
    ...(query.data ?? EMPTY_OVERVIEW),
    loading: query.isPending,
    error: query.isError ? 'dashboard.loadError' : null,
    refetch: query.refetch,
  };
};
