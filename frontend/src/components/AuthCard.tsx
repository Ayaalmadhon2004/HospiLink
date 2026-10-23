import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

/** Shared shell for the public auth pages (forgot / reset password, verify email). */
export const AuthCard = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
    <LanguageSwitcher className="absolute top-4 end-4 text-gray-700 hover:bg-gray-100" />
    <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
      <div className="flex items-center justify-center gap-2 mb-8">
        <Activity className="text-teal-500" size={32} aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900">HospiLink</h1>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">{title}</h2>
      {subtitle && <p className="text-gray-500 text-sm text-center mb-6">{subtitle}</p>}
      {children}
    </div>
  </div>
);

export const AuthMessage = ({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) => (
  <div
    role={kind === 'error' ? 'alert' : 'status'}
    className={
      kind === 'error'
        ? 'bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4'
        : 'bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg mb-4'
    }
  >
    {children}
  </div>
);

export const authInputClass =
  'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none';
export const authButtonClass =
  'w-full bg-teal-700 text-white py-2.5 rounded-lg hover:bg-teal-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium';
