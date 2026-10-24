import { useTranslation } from 'react-i18next';

interface BedOccupancyCardProps {
  loading: boolean;
  percent: number;
  occupied: number;
  total: number;
}

/** Leading stat of the overview: how full the hospital is. */
export const BedOccupancyCard = ({ loading, percent, occupied, total }: BedOccupancyCardProps) => {
  const { t } = useTranslation();
  return (
    <div className="sm:col-span-3 lg:col-span-1 bg-blue-800 text-white rounded-lg p-6">
      <h3 className="text-xs font-medium uppercase tracking-wider text-blue-200">{t('dashboard.bedOccupancy')}</h3>
      <p className="text-5xl font-semibold mt-3">{loading ? '...' : `${percent}%`}</p>
      <p className="text-sm text-blue-100 mt-2">{loading ? '' : t('dashboard.bedsInUse', { occupied, total })}</p>
      <div className="mt-4 h-1.5 w-full rounded-full bg-white/20">
        <div className="h-1.5 rounded-full bg-white transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};
