// components/Clinical/MedicationCatalogModal.tsx
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { FormModal } from '../Form';
import { medicationFields, type MedicationFormValues } from '../../configs/entityConfigs';
import { clinicalKeys, getMedications, createMedication, setMedicationActive } from '../../services/clinicalService';
import { getErrorMessage } from '../../types/api';
import { MINOR_PER_MAJOR, formatMoney } from '../../utils/money';

/** Hospital drug catalogue: add medications and retire them (no delete: prescriptions keep pointing at them). */
export const MedicationCatalogModal = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data: meds = [] } = useQuery({ queryKey: [...clinicalKeys.medications, 'all'], queryFn: () => getMedications(false) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: clinicalKeys.medications });

  const toggle = async (id: string, active: boolean) => {
    try {
      await setMedicationActive(id, active);
      await refresh();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('clinical.medications.updateFailed')));
    }
  };

  return (
    <div className="fixed inset-0 bg-hospital-navy/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="med-catalog-title">
      <div className="bg-white rounded-xl p-6 w-full max-w-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 id="med-catalog-title" className="text-lg font-bold">{t('clinical.medications.title')}</h3>
          <button onClick={onClose} aria-label={t('common.close')}><X className="w-5 h-5" aria-hidden="true" /></button>
        </div>
        <button onClick={() => setAdding(true)} className="mb-3 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium">{t('clinical.medications.add')}</button>
        <ul className="divide-y divide-slate-100">
          {meds.map((m) => (
            <li key={m.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className={m.active ? '' : 'text-gray-500 line-through'}>{m.name} · {m.form} · {m.strength}{m.unitPriceMinor ? ` · ${formatMoney(m.unitPriceMinor)}` : ''}</span>
              <button className="text-blue-700 underline shrink-0" onClick={() => toggle(m.id, !m.active)}>
                {m.active ? t('clinical.medications.retire') : t('clinical.medications.restore')}
              </button>
            </li>
          ))}
        </ul>
        {adding && (
          <FormModal<MedicationFormValues>
            isOpen
            onClose={() => setAdding(false)}
            title={t('clinical.medications.add')}
            fields={medicationFields}
            onSubmit={async (v) => {
              const { unitPrice, reorderLevel, ...rest } = v;
              await createMedication({
                ...rest,
                unitPriceMinor: unitPrice ? Math.round(Number(unitPrice) * MINOR_PER_MAJOR) : undefined,
                reorderLevel: reorderLevel ? Number(reorderLevel) : undefined,
              });
              await refresh();
            }}
            submitLabel={t('clinical.medications.add')}
            submittingLabel={t('common.saving')}
          />
        )}
      </div>
    </div>
  );
};
