// components/Staff/StaffModal.tsx
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
  const mode = initialData?.id ? 'edit' : 'create';

  const handleSubmit = async (values: StaffFormValues) => {
    const payload = {
      ...values,
      phone: values.phone || undefined,
      shiftStart: values.shiftStart || undefined,
      shiftEnd: values.shiftEnd || undefined,
    };

    if (mode === 'edit' && initialData?.id) {
      await updateStaff(initialData.id, payload);
    } else {
      await createStaff(payload as any);
    }
    onSuccess();
  };

  return (
    <FormModal<StaffFormValues>
      isOpen={isOpen}
      onClose={onClose}
      title="Staff Member"
      subtitle={mode === 'edit' ? 'Update staff details' : 'Add a new staff member'}
      fields={staffFields}
      initialValues={initialData}
      onSubmit={handleSubmit}
      submitLabel={mode === 'edit' ? 'Save Changes' : 'Add Staff'}
      submittingLabel={mode === 'edit' ? 'Saving...' : 'Adding...'}
      mode={mode}
    />
  );
};