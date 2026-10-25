import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { getErrorCode, getErrorMessage } from '../types/api';
import { getUsers, approveUser, rejectUser, deactivateUser, activateUser, changeUserRole, USERS_KEY } from '../services/userService';
import type { Role } from '../configs/permissions';

export type UserAction =
  | { type: 'approve'; id: string; role: Role }
  | { type: 'reject'; id: string }
  | { type: 'deactivate'; id: string }
  | { type: 'activate'; id: string; role: Role }
  | { type: 'role'; id: string; role: Role };

const run = (a: UserAction) => {
  switch (a.type) {
    case 'approve': return approveUser(a.id, a.role);
    case 'reject': return rejectUser(a.id);
    case 'deactivate': return deactivateUser(a.id);
    case 'activate': return activateUser(a.id, a.role);
    case 'role': return changeUserRole(a.id, a.role);
  }
};

/** Users of the hospital plus one mutation for every account action. Not optimistic: the server may refuse (last admin...). */
export const useUserManagement = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: USERS_KEY, queryFn: getUsers });

  const mutation = useMutation({
    mutationFn: run,
    onSuccess: (_data, action) => toast.success(t(`users.done.${action.type}`)),
    onError: (err: unknown) => {
      const code = getErrorCode(err);
      const known = code ? t(`errors.codes.${code}`, { defaultValue: '' }) : '';
      toast.error(known || getErrorMessage(err, t('users.actionFailed')));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });

  return { users, perform: mutation.mutate, busyId: mutation.isPending ? mutation.variables.id : null };
};
