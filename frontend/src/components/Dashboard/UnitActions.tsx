import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MoreVertical } from 'lucide-react';
import { apiPut } from '../../services/api';
import { STATUS_ORDER, type DispatchUnit, type UnitStatus } from '../../utils/dispatchUnits';

interface Props {
  unit: DispatchUnit;
}

/** Quick-action menu: change a unit's status (ADMIN / DISPATCHER only, enforced server-side too). */
const UnitActions: React.FC<Props> = ({ unit }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (status: UnitStatus) => apiPut(`/dispatch/units/${unit.id}/status`, { status }),
    onSuccess: () => {
      toast.success(t('dispatch.actions.updated', { unit: unit.unitCode }));
      queryClient.invalidateQueries({ queryKey: ['dispatch-units'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-start">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={mutation.isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('dispatch.actions.open', { unit: unit.unitCode })}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul role="menu" className="absolute end-0 z-20 mt-1 w-44 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
          <li role="presentation" className="px-3 py-1 text-xs font-medium text-gray-400">
            {t('dispatch.actions.setStatus')}
          </li>
          {STATUS_ORDER.filter((s) => s !== unit.status).map((s) => (
            <li key={s} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  mutation.mutate(s);
                }}
                className="w-full px-3 py-2 text-start text-sm text-gray-700 hover:bg-gray-50"
              >
                {t(`dispatch.status.${s}`)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UnitActions;
