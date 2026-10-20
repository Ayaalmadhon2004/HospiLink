// components/IncidentModal.tsx
import { useTranslation } from 'react-i18next';
import { FormModal } from './Form';
import { apiPost, apiPut } from '../services/api';
import { incidentFields, type IncidentFormValues } from '../configs/entityConfigs';

interface IncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Partial<IncidentFormValues> & { id?: string };
}

export const IncidentModal = ({ isOpen, onClose, onSuccess, initialData }: IncidentModalProps) => {
  const { t } = useTranslation();
  const mode = initialData?.id ? 'edit' : 'create';

  const handleSubmit = async (values: IncidentFormValues) => {
    const payload = {
      title: values.title,
      type: values.type,
      severity: values.severity,
      location: values.location,
      reportedBy: values.reportedBy,
      description: values.description,
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
      title={t('incidents.modal.title')}
      subtitle={mode === 'edit' ? t('incidents.modal.editSubtitle') : t('incidents.modal.createSubtitle')}
      fields={incidentFields}
      initialValues={initialData}
      onSubmit={handleSubmit}
      submitLabel={mode === 'edit' ? t('incidents.modal.save') : t('incidents.report')}
      submittingLabel={mode === 'edit' ? t('common.saving') : t('incidents.modal.reporting')}
      mode={mode}
    />
  );
};