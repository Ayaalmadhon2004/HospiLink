import {
  LayoutDashboard,
  Users,
  BedDouble,
  Stethoscope,
  Calendar,
  Activity,
  AlertTriangle,
  Truck,
  Settings,
  ScrollText,
  UserCog,
  Pill,
  Receipt,
  type LucideIcon,
} from 'lucide-react';
import type { BadgeItemId } from '../hooks/useSidebarBadges';

export interface NavItem {
  /** Stable id, also the suffix of the `sidebar.tabs.<id>` translation key. */
  id: string;
  /** Route the item links to. The URL is the only navigation state. */
  path: string;
  icon: LucideIcon;
  /** Sidebar counter fed by `useSidebarBadges`. */
  badge?: BadgeItemId;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { id: 'Patients', path: '/patients', icon: Users, badge: 'Patients' },
  { id: 'Beds & Wards', path: '/beds', icon: BedDouble },
  { id: 'Staff & Shifts', path: '/staff', icon: Stethoscope },
  { id: 'Appointments', path: '/appointments', icon: Calendar, badge: 'Appointments' },
  { id: 'Vitals Monitor', path: '/vitals', icon: Activity, badge: 'Vitals' },
  { id: 'Incidents', path: '/incidents', icon: AlertTriangle, badge: 'Incidents' },
  { id: 'Dispatch', path: '/dispatch', icon: Truck },
  { id: 'Pharmacy', path: '/pharmacy', icon: Pill },
  { id: 'Billing', path: '/billing', icon: Receipt },
  { id: 'Users', path: '/users', icon: UserCog },
  { id: 'Audit Log', path: '/audit-logs', icon: ScrollText },
];

export const SETTINGS_NAV_ITEM: NavItem = { id: 'Settings', path: '/settings', icon: Settings };

const ALL_ITEMS: readonly NavItem[] = [...NAV_ITEMS, SETTINGS_NAV_ITEM];

/** The item whose route contains `pathname` (`/patients/123` belongs to Patients), if any. */
export const findNavItem = (pathname: string): NavItem | undefined =>
  ALL_ITEMS.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
