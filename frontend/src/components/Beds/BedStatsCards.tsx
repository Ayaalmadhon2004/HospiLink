import { useTranslation } from 'react-i18next';
import { BedDouble, Filter, User } from 'lucide-react';
import type { BedWithDetails } from '../../types/bed';

export const BedStatsCards = ({ beds }: { beds: BedWithDetails[] }) => {
  const { t } = useTranslation();
  const stats = {
    total: beds.length,
    available: beds.filter(b => b.status === 'AVAILABLE').length,
    occupied: beds.filter(b => b.status === 'OCCUPIED').length,
    maintenance: beds.filter(b => b.status === 'MAINTENANCE').length,
    cleaning: beds.filter(b => b.status === 'CLEANING').length,
  };

  return (
    <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{t('beds.stats.total')}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <BedDouble className="w-5 h-5 text-blue-600" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{t('beds.status.AVAILABLE')}</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.available}</p>
          </div>
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{t('beds.status.OCCUPIED')}</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.occupied}</p>
          </div>
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-red-600" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{t('beds.status.CLEANING')}</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.cleaning}</p>
          </div>
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{t('beds.status.MAINTENANCE')}</p>
            <p className="text-2xl font-bold text-slate-600 mt-1">{stats.maintenance}</p>
          </div>
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
            <Filter className="w-5 h-5 text-slate-600" />
          </div>
        </div>
      </div>
    </section>
  );
};
