import { describe, it, expect } from 'vitest';
import { appointmentDot, bedOccupancy, buildDepartmentLoads, getGreetingKey } from './dashboardStats';

describe('dashboardStats', () => {
  it('computes the occupancy percentage and survives an empty hospital', () => {
    expect(bedOccupancy(3, 4)).toBe(75);
    expect(bedOccupancy(1, 3)).toBe(33);
    expect(bedOccupancy(0, 0)).toBe(0);
  });

  it('counts patients per department, always lists the defaults and sorts busiest first', () => {
    const loads = buildDepartmentLoads([{ department: 'ICU' }, { department: 'ICU' }, { department: 'Cardiology' }, {}, { department: 'Dermatology' }]);
    expect(loads.slice(0, 2).map((l) => [l.name, l.current])).toEqual([['ICU', 2], ['Cardiology', 1]]);
    expect(loads.find((l) => l.name === 'General')?.current).toBe(1); // no department -> General
    expect(loads.find((l) => l.name === 'Emergency')?.current).toBe(0);
    expect(loads.find((l) => l.name === 'Dermatology')).toMatchObject({ current: 1, color: 'gray' });
    expect(loads.find((l) => l.name === 'ICU')).toMatchObject({ color: 'orange', max: 50 });
  });

  it('picks a greeting by hour and a dot by appointment type', () => {
    expect(getGreetingKey(new Date(2026, 0, 1, 8))).toBe('dashboard.greeting.morning');
    expect(getGreetingKey(new Date(2026, 0, 1, 14))).toBe('dashboard.greeting.afternoon');
    expect(getGreetingKey(new Date(2026, 0, 1, 21))).toBe('dashboard.greeting.evening');
    expect(appointmentDot('SURGERY')).toBe('bg-red-500');
    expect(appointmentDot('OTHER')).toBe('bg-gray-400');
  });
});
