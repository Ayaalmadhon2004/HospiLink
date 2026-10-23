// Central status config + KPI/alarm helpers for the dispatch dashboard.

export type UnitStatus = 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'TRANSPORTING' | 'AT_HOSPITAL' | 'OFF_DUTY';

export interface DispatchCallInfo {
  id: string;
  type: string;
  location: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface DispatchUnit {
  id: string;
  unitCode: string;
  unitType: string;
  status: UnitStatus | string;
  currentCall?: DispatchCallInfo | null;
  crew: string[];
  eta?: number | null;
  lastUpdated?: string;
}

interface StatusStyle {
  badge: string;
  dot: string;
}

// Light Clinical palette: soft green = ready, amber = moving, red = at an incident.
export const STATUS_CONFIG: Record<UnitStatus, StatusStyle> = {
  AVAILABLE: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  EN_ROUTE: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  ON_SCENE: { badge: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  TRANSPORTING: { badge: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  AT_HOSPITAL: { badge: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  OFF_DUTY: { badge: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
};

const FALLBACK_STYLE = STATUS_CONFIG.OFF_DUTY;
export const getStatusStyle = (status: string): StatusStyle =>
  STATUS_CONFIG[status as UnitStatus] ?? FALLBACK_STYLE;

export const STATUS_ORDER = Object.keys(STATUS_CONFIG) as UnitStatus[];

export const ON_SCENE_LIMIT_MIN = 30;
export const EN_ROUTE_STALE_MIN = 15;

export type AlarmKind = 'critical' | 'prolongedOnScene' | 'delayed';

const MS_PER_MINUTE = 60_000;

const minutesSince = (iso: string | undefined, now: number): number =>
  iso ? Math.max(0, (now - new Date(iso).getTime()) / MS_PER_MINUTE) : 0;

/** Returns the most urgent alarm for a unit, or null. */
export const getUnitAlarm = (unit: DispatchUnit, now: number): AlarmKind | null => {
  if (unit.status === 'OFF_DUTY' || unit.status === 'AVAILABLE') return null;
  if (unit.currentCall?.priority === 'CRITICAL') return 'critical';
  const age = minutesSince(unit.lastUpdated, now);
  if (unit.status === 'ON_SCENE' && age > ON_SCENE_LIMIT_MIN) return 'prolongedOnScene';
  if (unit.status === 'EN_ROUTE' && age > Math.max(unit.eta ?? 0, EN_ROUTE_STALE_MIN)) return 'delayed';
  return null;
};

export const computeUnitStats = (units: DispatchUnit[], now: number) => ({
  active: units.filter((u) => u.status !== 'OFF_DUTY').length,
  available: units.filter((u) => u.status === 'AVAILABLE').length,
  enRoute: units.filter((u) => u.status === 'EN_ROUTE').length,
  onScene: units.filter((u) => u.status === 'ON_SCENE').length,
  alarms: units.filter((u) => getUnitAlarm(u, now) !== null).length,
});
