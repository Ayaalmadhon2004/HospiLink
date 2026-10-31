// components/Pharmacy/DispensationsList.tsx
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getDispensations, pharmacyKeys } from '../../services/pharmacyService';
import { formatDateTime } from '../../utils/datetime';
import { formatMoney } from '../../utils/money';

/** What the pharmacy has handed to this patient (newest first), shown under the prescriptions. */
export const DispensationsList = ({ patientId }: { patientId: string }) => {
  const { t } = useTranslation();
  const { data, isPending, isError } = useQuery({ queryKey: pharmacyKeys.dispensations(patientId), queryFn: () => getDispensations(patientId) });

  return (
    <section aria-labelledby="dispensations-title" className="pt-4 border-t border-slate-200 space-y-2">
      <h3 id="dispensations-title" className="font-semibold text-gray-900">{t('pharmacy.dispensations.title')}</h3>
      {isError ? <p role="alert" className="text-sm text-red-700">{t('pharmacy.dispensations.loadFailed')}</p>
        : isPending ? <p className="text-sm text-gray-500">{t('common.loading')}</p>
        : data.length === 0 ? <p className="text-sm text-gray-500">{t('pharmacy.dispensations.empty')}</p>
        : (
          <ul className="space-y-1 text-sm">
            {data.map((d) => (
              <li key={d.id}>
                <span className="font-medium">{d.medication.name} {d.medication.strength}</span> ({d.medication.form}) — {t('pharmacy.dispensations.units', { count: d.quantity })}, {formatMoney(d.unitPriceMinor * d.quantity)}
                <span className="text-gray-500"> · {d.dispensedByName} · <time dateTime={d.createdAt}>{formatDateTime(d.createdAt)}</time></span>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
};
