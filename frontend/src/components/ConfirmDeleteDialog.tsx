
import { AlertTriangle} from 'lucide-react';

interface ConfirmDeleteDialogProps {
  isOpen: boolean;
  title?: string;
  name: string;
  itemType?: string;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export const ConfirmDeleteDialog = ({
  isOpen,
  title,
  name,
  itemType = 'item',
  onCancel,
  onConfirm,
  isLoading = false,
}: ConfirmDeleteDialogProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-full max-w-sm animate-in zoom-in-95 duration-200"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-desc"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-rose-500" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 
              id="confirm-delete-title" 
              className="font-semibold text-gray-900 text-base"
            >
              {title || `Delete ${name}?`}
            </h3>
            <p 
              id="confirm-delete-desc" 
              className="text-gray-500 text-sm mt-1.5 leading-relaxed"
            >
              This {itemType} will be permanently removed from the system. 
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteDialog;