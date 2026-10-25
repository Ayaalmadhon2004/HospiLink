import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../types/api';
import { billingKeys, getInvoice } from '../services/billingService';

/** One invoice plus `run(action)`: every change goes to the server, then the invoice is reloaded (nothing is optimistic: totals are server-side). */
export const useInvoice = (id: string) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const invoice = useQuery({ queryKey: billingKeys.one(id), queryFn: () => getInvoice(id) });

  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onError: (err: unknown) => {
      // ApiError already carries the translated text of known codes (see normalizeApiError).
      toast.error(getErrorMessage(err, t('billing.actionFailed')));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: billingKeys.one(id) });
      queryClient.invalidateQueries({ queryKey: billingKeys.list });
    },
  });

  return { invoice, run: mutation.mutateAsync, busy: mutation.isPending };
};
