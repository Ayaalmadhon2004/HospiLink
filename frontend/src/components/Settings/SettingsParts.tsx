export const Toggle: React.FC<{
  enabled: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}> = ({ enabled, onChange, label, disabled = false }) => (
  <button
    type="button"
    onClick={onChange}
    disabled={disabled}
    className={`relative shrink-0 w-12 h-7 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 outline-none ${
      enabled ? 'bg-teal-600' : 'bg-gray-300'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    role="switch"
    aria-checked={enabled}
    aria-label={label}
  >
    <span
      className={`absolute top-1 start-1 w-5 h-5 bg-white rounded-full transition-transform ${
        enabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

export const SettingRow: React.FC<{
  title: string;
  description: string;
  badge?: string;
  first?: boolean;
  children: React.ReactNode;
}> = ({ title, description, badge, first = false, children }) => (
  <div className={`${first ? '' : 'border-t border-gray-100 pt-6'} flex items-center justify-between gap-4`}>
    <div className="min-w-0">
      <h3 className="font-medium text-gray-800 flex flex-wrap items-center gap-2">
        {title}
        {badge && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{badge}</span>
        )}
      </h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
    {children}
  </div>
);

export const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-3 mb-6">
    {icon}
    <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
  </div>
);

export const Field: React.FC<{ label: string; htmlFor: string; children: React.ReactNode }> = ({ label, htmlFor, children }) => (
  <div>
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-2">
      {label}
    </label>
    {children}
  </div>
);
