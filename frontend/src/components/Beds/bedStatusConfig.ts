import type { TFunction } from 'i18next';
import type { BedStatus } from '../../types/bed';

export const getBedStatusConfig = (t: TFunction, status: BedStatus) => {
  switch (status) {
    case 'AVAILABLE':
      return { badge: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200', label: t('beds.status.AVAILABLE'), dot: 'bg-emerald-500' };
    case 'OCCUPIED':
      return { badge: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200', label: t('beds.status.OCCUPIED'), dot: 'bg-red-500' };
    case 'MAINTENANCE':
      return { badge: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200', label: t('beds.status.MAINTENANCE'), dot: 'bg-slate-500' };
    case 'CLEANING':
      return { badge: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200', label: t('beds.status.CLEANING'), dot: 'bg-amber-500' };
  }
};
