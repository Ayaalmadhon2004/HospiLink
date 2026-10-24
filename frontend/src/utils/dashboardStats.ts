export interface DepartmentLoad {
  name: string;
  current: number;
  max: number;
  color: string;
}

const DEPARTMENT_CAPACITY = 50;

const DEPARTMENT_COLORS: Record<string, string> = {
  Emergency: 'red',
  ICU: 'orange',
  Surgery: 'blue',
  Pediatrics: 'green',
  Maternity: 'purple',
  Cardiology: 'teal',
  General: 'gray',
};

const DEFAULT_DEPARTMENTS = Object.keys(DEPARTMENT_COLORS);

export const APPOINTMENT_TYPE_DOTS: Record<string, string> = {
  SURGERY: 'bg-red-500',
  CONSULTATION: 'bg-teal-500',
  IMAGING: 'bg-blue-500',
  FOLLOW_UP: 'bg-amber-500',
};

export const appointmentDot = (type: string): string => APPOINTMENT_TYPE_DOTS[type] ?? 'bg-gray-400';

export const getGreetingKey = (date: Date): string => {
  const hour = date.getHours();
  if (hour < 12) return 'dashboard.greeting.morning';
  if (hour < 18) return 'dashboard.greeting.afternoon';
  return 'dashboard.greeting.evening';
};

/** Occupied beds as a whole percentage (0 when there are no beds). */
export const bedOccupancy = (occupied: number, total: number): number =>
  total > 0 ? Math.round((occupied / total) * 100) : 0;

/** Patients per department, with the default departments always listed, busiest first. */
export const buildDepartmentLoads = (patients: ReadonlyArray<{ department?: string }>): DepartmentLoad[] => {
  const counts = new Map<string, number>(DEFAULT_DEPARTMENTS.map((name) => [name, 0]));
  for (const patient of patients) {
    const name = patient.department || 'General';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts, ([name, current]) => ({
    name,
    current,
    max: DEPARTMENT_CAPACITY,
    color: DEPARTMENT_COLORS[name] ?? 'gray',
  })).sort((a, b) => b.current - a.current);
};
