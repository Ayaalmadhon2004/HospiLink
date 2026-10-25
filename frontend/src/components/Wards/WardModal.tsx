// components/Wards/WardModal.tsx
import { useTranslation } from 'react-i18next';
import { FormModal } from '../Form';
import { wardFields, type WardFormValues } from '../../configs/entityConfigs';
import { createWard, updateWard } from '../../services/wardService';
import type { Ward } from '../../types/ward';

interface WardModalProps {
  isOpen: boolean;
  ward: Ward | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const WardModal = ({ isOpen, ward, onClose, onSuccess }: WardModalProps) => {
  const { t } = useTranslation();
  const mode = ward ? 'edit' : 'create';

  const handleSubmit = async (values: WardFormValues) => {
    // The form drops an empty number field, so "no floor" is sent as null (clears it on update).
    const body = { name: values.name.trim(), floor: values.floor ? Number(values.floor) : null };
    if (ward) await updateWard(ward.id, body);
    else await createWard(body);
    onSuccess();
  };

  return (
    <FormModal<WardFormValues>
      isOpen={isOpen}
      onClose={onClose}
      title={ward ? t('wards.modalEdit') : t('wards.modalAdd')}
      subtitle={ward ? t('wards.modalEditSubtitle') : t('wards.modalAddSubtitle')}
      fields={wardFields}
      initialValues={ward ? { name: ward.name, floor: ward.floor === null ? undefined : String(ward.floor) } : undefined}
      onSubmit={handleSubmit}
      submitLabel={ward ? t('wards.save') : t('wards.add')}
      submittingLabel={t('common.saving')}
      mode={mode}
    />
  );
};
