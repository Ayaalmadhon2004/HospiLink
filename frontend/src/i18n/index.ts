import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ar from './locales/ar.json';

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = 'hospilink_lang';
const LANGUAGE_CODE_LENGTH = 2; // "ar-JO" -> "ar"
const RTL_LANGUAGES: readonly string[] = ['ar'];

export const isSupported = (lng: string | null | undefined): lng is Language =>
  !!lng && (SUPPORTED_LANGUAGES as readonly string[]).includes(lng);

export const isRtl = (lng: string): boolean => RTL_LANGUAGES.includes(lng);

/** Saved choice -> browser language -> English. Storage may be blocked, so every access is guarded. */
export const detectLanguage = (): Language => {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupported(saved)) return saved;
  } catch {
    /* storage unavailable (private mode, blocked cookies) */
  }
  const browser = typeof navigator !== 'undefined' ? navigator.language?.slice(0, LANGUAGE_CODE_LENGTH) : undefined;
  return isSupported(browser) ? browser : 'en';
};

const applyDocumentLanguage = (lng: string): void => {
  const root = document.documentElement;
  root.lang = lng;
  root.dir = isRtl(lng) ? 'rtl' : 'ltr';
};

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED_LANGUAGES],
  interpolation: { escapeValue: false }, // React already escapes
});

applyDocumentLanguage(i18n.language);

i18n.on('languageChanged', (lng) => {
  applyDocumentLanguage(lng);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    /* ignore: the choice just will not persist */
  }
});

export default i18n;
