// components/Users/UserRow.tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Role } from '../../configs/permissions';
import { ROLES, type ManagedUser } from '../../types/user';
import type { UserAction } from '../../hooks/useUserManagement';

interface UserRowProps {
  user: ManagedUser;
  isSelf: boolean;
  busy: boolean;
  onAction: (action: UserAction) => void;
  /** An ACTIVE user's role change signs them out, so the page asks for confirmation first. */
  onRequestRoleChange: (user: ManagedUser, role: Role) => void;
}

const BADGE: Record<ManagedUser['accountStatus'], string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  PENDING: 'bg-amber-50 text-amber-800 ring-amber-200',
  DISABLED: 'bg-slate-100 text-slate-700 ring-slate-200',
};
const BTN = 'px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50';

export const UserRow = ({ user, isSelf, busy, onAction, onRequestRoleChange }: UserRowProps) => {
  const { t } = useTranslation();
  // Role picked for approve / activate (the stored role of a PENDING / rejected row is only a placeholder).
  const [chosen, setChosen] = useState<Role>(user.role);
  const active = user.accountStatus === 'ACTIVE';

  return (
    <tr className="align-middle">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">
          {user.name} {isSelf && <span className="text-xs text-gray-500">({t('users.you')})</span>}
        </div>
        <div className="text-xs text-gray-500">{user.email}</div>
      </td>
      <td className="px-4 py-3 text-gray-600">{user.department}</td>
      <td className="px-4 py-3">
        <label className="sr-only" htmlFor={`role-${user.id}`}>{t('users.roleFor', { name: user.name })}</label>
        <select
          id={`role-${user.id}`}
          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white disabled:bg-gray-50"
          value={active ? user.role : chosen}
          disabled={busy || isSelf}
          onChange={(e) => {
            const role = e.target.value as Role;
            if (active) onRequestRoleChange(user, role);
            else setChosen(role);
          }}
        >
          {ROLES.map((r) => <option key={r} value={r}>{t(`users.roles.${r}`)}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${BADGE[user.accountStatus]}`}>
          {t(`users.status.${user.accountStatus}`)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {user.accountStatus === 'PENDING' && (
            <>
              <button className={`${BTN} bg-blue-600 text-white`} disabled={busy} onClick={() => onAction({ type: 'approve', id: user.id, role: chosen })}>{t('users.approve')}</button>
              <button className={`${BTN} bg-gray-100 text-gray-700`} disabled={busy} onClick={() => onAction({ type: 'reject', id: user.id })}>{t('users.reject')}</button>
            </>
          )}
          {user.accountStatus === 'DISABLED' && (
            <button className={`${BTN} bg-blue-600 text-white`} disabled={busy} onClick={() => onAction({ type: 'activate', id: user.id, role: chosen })}>{t('users.activate')}</button>
          )}
          {active && !isSelf && (
            <button className={`${BTN} bg-red-50 text-red-700`} disabled={busy} onClick={() => onAction({ type: 'deactivate', id: user.id })}>{t('users.deactivate')}</button>
          )}
        </div>
      </td>
    </tr>
  );
};
