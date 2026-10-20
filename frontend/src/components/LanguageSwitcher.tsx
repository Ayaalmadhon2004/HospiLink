import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Language } from '../i18n';

const NATIVE_NAMES: Record<Language, string> = { en: 'English', ar: 'العربية' };

interface LanguageSwitcherProps {
  className?: string;
}

/** Toggles between English and Arabic; i18n/index.ts applies dir/lang and persists the choice. */
export const LanguageSwitcher = ({ className = '' }: LanguageSwitcherProps) => {
  const { t, i18n } = useTranslation();
  const target: Language = i18n.language === 'ar' ? 'en' : 'ar';

  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(target)}
      aria-label={`${t('common.switchLanguage')}: ${NATIVE_NAMES[target]}`}
      lang={target}
      className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 ${className}`}
    >
      <Languages className="w-4 h-4" aria-hidden="true" />
      <span>{NATIVE_NAMES[target]}</span>
    </button>
  );
};
