import { useTranslation } from 'react-i18next';
import { DepartmentBar } from '../DepartmentBar';
import { EmptyState, LoadingSpinner } from './StatusBlocks';
import type { DepartmentLoad } from '../../../utils/dashboardStats';

interface DepartmentLoadSectionProps {
  loading: boolean;
  loads: readonly DepartmentLoad[];
}

export const DepartmentLoadSection = ({ loading, loads }: DepartmentLoadSectionProps) => {
  const { t } = useTranslation();
  return (
    <section className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6" aria-labelledby="dept-load-heading">
      <div className="flex justify-between items-center mb-6">
        <h2 id="dept-load-heading" className="text-base font-semibold text-gray-900">{t('dashboard.departmentLoad')}</h2>
      </div>
      <div className="space-y-4">
        {loading ? (
          <LoadingSpinner />
        ) : loads.length > 0 ? (
          loads.map((dept) => (
            <DepartmentBar
              key={dept.name}
              title={t(`dashboard.departments.${dept.name}`, { defaultValue: dept.name })}
              current={dept.current}
              max={dept.max}
              color={dept.color}
            />
          ))
        ) : (
          <EmptyState message={t('dashboard.noDepartments')} />
        )}
      </div>
    </section>
  );
};
