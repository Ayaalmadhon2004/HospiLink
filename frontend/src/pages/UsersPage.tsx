// pages/UsersPage.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserCog } from 'lucide-react';
import { UserRow } from '../components/Users/UserRow';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../contexts/authContext';
import { useUserManagement } from '../hooks/useUserManagement';
import type { Role } from '../configs/permissions';
import type { AccountStatus, ManagedUser } from '../types/user';

type Filter = 'ALL' | AccountStatus;
const FILTERS: Filter[] = ['ALL', 'PENDING', 'ACTIVE', 'DISABLED'];

export const UsersPage = () => {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const { users, perform, busyId } = useUserManagement();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [pendingRole, setPendingRole] = useState<{ user: ManagedUser; role: Role } | null>(null);

  const all = users.data ?? [];
  const visible = all.filter((u) => filter === 'ALL' || u.accountStatus === filter);
  const pendingCount = all.filter((u) => u.accountStatus === 'PENDING').length;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <UserCog className="w-6 h-6 text-blue-600" aria-hidden="true" />
          {t('users.title')}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{t('users.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('users.filter')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
          >
            {t(`users.filters.${f}`)}{f === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {users.isError ? (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 flex justify-between">
          <span>{t('users.loadFailed')}</span>
          <button className="underline font-medium" onClick={() => users.refetch()}>{t('audit.retry')}</button>
        </div>
      ) : users.isPending ? (
        <div className="flex justify-center h-32 items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" role="status" aria-label={t('users.loading')} />
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">{t('users.empty')}</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-gray-600">
              <tr>
                {(['user', 'department', 'role', 'status', 'actions'] as const).map((c) => (
                  <th key={c} scope="col" className="px-4 py-3 text-start font-medium">{t(`users.cols.${c}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((u) => (
                <UserRow
                  key={`${u.id}-${u.accountStatus}`}
                  user={u}
                  isSelf={u.id === me?.id}
                  busy={busyId === u.id}
                  onAction={perform}
                  onRequestRoleChange={(user, role) => setPendingRole({ user, role })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={!!pendingRole}
        onClose={() => setPendingRole(null)}
        onConfirm={() => {
          if (pendingRole) perform({ type: 'role', id: pendingRole.user.id, role: pendingRole.role });
        }}
        title={t('users.confirmRoleTitle')}
        message={pendingRole ? t('users.confirmRole', { name: pendingRole.user.name, from: t(`users.roles.${pendingRole.user.role}`), to: t(`users.roles.${pendingRole.role}`) }) : ''}
        tone="primary"
      />
    </div>
  );
};
