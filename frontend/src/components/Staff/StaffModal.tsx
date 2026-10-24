// components/Staff/StaffModal.tsx
import { useTranslation } from 'react-i18next';
import { FormModal } from '../Form/FormModal';
import { createStaff, updateStaff } from '../../services/staffService';
import {
  staffFields,
  type StaffFormValues,
} from '../../configs/entityConfigs';

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<StaffFormValues> & { id?: string };
}

export const StaffModal = ({ isOpen, onClose, onSuccess, initialData }: StaffModalProps) => {
  const { t } = useTranslation();
  const mode = initialData?.id ? 'edit' : 'create';

  const handleSubmit = async (values: StaffFormValues) => {
    const payload = {
      ...values,
      loginRole: mode === 'create' ? values.loginRole || undefined : undefined,
      phone: values.phone || undefined,
      shiftStart: values.shiftStart || undefined,
      shiftEnd: values.shiftEnd || undefined,
    };

    if (mode === 'edit' && initialData?.id) {
      await updateStaff(initialData.id, payload);
    } else {
      await createStaff(payload);
    }
    onSuccess();
  };

  return (
    <FormModal<StaffFormValues>
      isOpen={isOpen}
      onClose={onClose}
      title={t('staff.modal.title')}
      subtitle={mode === 'edit' ? t('staff.modal.editSubtitle') : t('staff.modal.createSubtitle')}
      // Creating a login only makes sense when adding a staff member; the link is managed by the server afterwards.
      fields={mode === 'create' ? staffFields : staffFields.filter((f) => f.name !== 'loginRole')}
      initialValues={initialData}
      onSubmit={handleSubmit}
      submitLabel={mode === 'edit' ? t('staff.modal.save') : t('staff.modal.add')}
      submittingLabel={mode === 'edit' ? t('common.saving') : t('staff.modal.adding')}
      mode={mode}
    />
  );
};