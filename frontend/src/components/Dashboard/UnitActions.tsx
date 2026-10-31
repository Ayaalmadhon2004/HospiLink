import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MoreVertical } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../../services/api';
import type { ApiResponse } from '../../types/api';
import { STATUS_ORDER, type DispatchCallInfo, type DispatchUnit, type UnitStatus } from '../../utils/dispatchUnits';

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

  const activeCall = unit.currentCall ?? null;
  const canAssign = unit.status === 'AVAILABLE' && !activeCall;

  const closeCall = useMutation({
    mutationFn: (action: 'complete' | 'cancel') => apiPost(`/dispatch/calls/${activeCall?.id}/${action}`),
    onSuccess: (_data, action) => {
      toast.success(t(action === 'complete' ? 'dispatch.actions.completed' : 'dispatch.actions.cancelled', { unit: unit.unitCode }));
      queryClient.invalidateQueries({ queryKey: ['dispatch-units'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-calls'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const { data: pendingCalls = [] } = useQuery({
    queryKey: ['dispatch-calls', 'PENDING'],
    queryFn: async () => (await apiGet<ApiResponse<DispatchCallInfo[]>>('/dispatch/calls', { status: 'PENDING' }))?.data ?? [],
    enabled: open && canAssign,
  });

  const assign = useMutation({
    mutationFn: (callId: string) => apiPost(`/dispatch/calls/${callId}/assign`, { unitId: unit.id }),
    onSuccess: () => {
      toast.success(t('dispatch.actions.assigned', { unit: unit.unitCode }));
      queryClient.invalidateQueries({ queryKey: ['dispatch-units'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-calls'] });
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
        disabled={mutation.isPending || assign.isPending || closeCall.isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('dispatch.actions.open', { unit: unit.unitCode })}
        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul role="menu" className="absolute end-0 z-20 mt-1 w-56 rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
          {canAssign && (
            <>
              <li role="presentation" className="px-3 py-1 text-xs font-medium text-gray-500">
                {t('dispatch.actions.assign')}
              </li>
              {pendingCalls.length === 0 && (
                <li role="presentation" className="px-3 py-2 text-sm text-gray-500">{t('dispatch.actions.noPending')}</li>
              )}
              {pendingCalls.map((c) => (
                <li key={c.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      assign.mutate(c.id);
                    }}
                    className="w-full px-3 py-2 text-start text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span className={c.priority === 'CRITICAL' ? 'font-semibold text-red-700' : ''}>{c.type}</span>
                    <span className="block text-xs text-gray-500">{c.location}</span>
                  </button>
                </li>
              ))}
              <li role="separator" className="my-1 border-t border-gray-100" />
            </>
          )}
          {activeCall && (
            <>
              <li role="presentation" className="px-3 py-1 text-xs font-medium text-gray-500">
                {activeCall.type}
              </li>
              {(['complete', 'cancel'] as const).map((action) => (
                <li key={action} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      closeCall.mutate(action);
                    }}
                    className="w-full px-3 py-2 text-start text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {t(action === 'complete' ? 'dispatch.actions.completeCall' : 'dispatch.actions.cancelCall')}
                  </button>
                </li>
              ))}
              <li role="separator" className="my-1 border-t border-gray-100" />
            </>
          )}
          <li role="presentation" className="px-3 py-1 text-xs font-medium text-gray-500">
            {t('dispatch.actions.setStatus')}
          </li>
          {/* A unit on a call cannot be freed by hand: complete or cancel the call (the server enforces it too). */}
          {STATUS_ORDER.filter((s) => s !== unit.status && !(activeCall && (s === 'AVAILABLE' || s === 'OFF_DUTY'))).map((s) => (
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
