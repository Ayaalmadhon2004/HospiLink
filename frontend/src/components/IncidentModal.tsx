// components/IncidentModal.tsx
import { FormModal } from './Form';
import { apiPost, apiPut } from '../services/api';
import {
  incidentFields,
  type IncidentFormValues,
} from '../configs/entityConfigs';

interface IncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<IncidentFormValues> & { id?: string };
}

export const IncidentModal = ({ isOpen, onClose, onSuccess, initialData }: IncidentModalProps) => {
  const mode = initialData?.id ? 'edit' : 'create';

  const handleSubmit = async (values: IncidentFormValues) => {
    const payload = {
      ...values,
      patientId: values.patientId || undefined,
      actionTaken: values.actionTaken || undefined,
    };

    if (mode === 'edit' && initialData?.id) {
      await apiPut(`/incidents/${initialData.id}`, payload);
    } else {
      await apiPost('/incidents', payload);
    }
    onSuccess();
  };

  return (
    <FormModal<IncidentFormValues>
      isOpen={isOpen}
      onClose={onClose}
      title="Incident Report"
      subtitle={mode === 'edit' ? 'Update incident details' : 'Report a new incident'}
      fields={incidentFields}
      initialValues={initialData}
      onSubmit={handleSubmit}
      submitLabel={mode === 'edit' ? 'Save Changes' : 'Report Incident'}
      submittingLabel={mode === 'edit' ? 'Saving...' : 'Reporting...'}
      mode={mode}
    />
  );
};