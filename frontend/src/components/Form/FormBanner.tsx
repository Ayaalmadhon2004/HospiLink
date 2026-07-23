// components/Form/FormBanner.tsx
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface FormBannerProps {
  error?: string;
  errorDetail?: string;
  success?: string;
}

export const FormBanner = ({ error, errorDetail, success }: FormBannerProps) => (
  <>
    {error && (
      <div 
        className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-start gap-2" 
        role="alert" 
        aria-live="assertive"
      >
        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <span className="font-medium">{error}</span>
          {errorDetail && <p className="text-xs text-red-400 mt-0.5">{errorDetail}</p>}
        </div>
      </div>
    )}
    {success && (
      <div 
        className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2" 
        role="status" 
        aria-live="polite"
      >
        <CheckCircle2 size={16} className="shrink-0" aria-hidden="true" />
        <span>{success}</span>
      </div>
    )}
  </>
);