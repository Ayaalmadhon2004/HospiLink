// components/ConfirmModal.tsx
import { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import type { ConfirmModalProps } from './Form/types';

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmingLabel = 'Confirming...',
  cancelLabel = 'Cancel',
  tone = 'danger',
}: ConfirmModalProps) => {
  const [confirming, setConfirming] = useState(false);

  if (!isOpen) return null;

  const toneColors = {
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    primary: 'bg-hospital-navy hover:bg-hospital-navy/90 focus:ring-hospital-navy',
    neutral: 'bg-slate-700 hover:bg-slate-800 focus:ring-slate-500',
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Confirm action failed:', err);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirming) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${tone === 'danger' ? 'bg-red-50' : 'bg-slate-50'}`}>
            <AlertTriangle
              size={24}
              className={tone === 'danger' ? 'text-red-600' : 'text-slate-600'}
            />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-hospital-navy">{title}</h3>
            <div className="text-sm text-clinic-text/70 mt-1">{message}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition"
            disabled={confirming}
          >
            <X size={18} className="text-clinic-text/40" />
          </button>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-slate-100 text-clinic-text px-4 py-2.5 rounded-xl hover:bg-slate-200 transition font-medium"
            disabled={confirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming}
            className={`flex-1 text-white px-4 py-2.5 rounded-xl transition font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${toneColors[tone]}`}
          >
            {confirming ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {confirmingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};