// Applies display settings to <html> and keeps a localStorage copy so the first paint after reload matches.
export type ThemeSetting = 'light' | 'dark' | 'system';

export interface CachedDisplay {
  theme: ThemeSetting;
  compact: boolean;
}

export const DISPLAY_CACHE_KEY = 'hospilink_display';
export const DEFAULT_DISPLAY: CachedDisplay = { theme: 'light', compact: false };

const isTheme = (v: unknown): v is ThemeSetting => v === 'light' || v === 'dark' || v === 'system';

export const readDisplayCache = (): CachedDisplay => {
  try {
    const raw = localStorage.getItem(DISPLAY_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CachedDisplay>;
      return {
        theme: isTheme(parsed.theme) ? parsed.theme : DEFAULT_DISPLAY.theme,
        compact: parsed.compact === true,
      };
    }
  } catch {
    /* storage unavailable or corrupt: use defaults */
  }
  return DEFAULT_DISPLAY;
};

export const writeDisplayCache = (value: CachedDisplay): void => {
  try {
    localStorage.setItem(DISPLAY_CACHE_KEY, JSON.stringify(value));
  } catch {
    /* ignore: just no flash protection */
  }
};

export const prefersDark = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;

/** `system` resolves to light/dark through matchMedia. */
export const resolveTheme = (theme: ThemeSetting): 'light' | 'dark' => {
  if (theme !== 'system') return theme;
  return prefersDark() ? 'dark' : 'light';
};

export const applyDisplay = ({ theme, compact }: CachedDisplay): void => {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolveTheme(theme));
  root.classList.toggle('compact', compact);
  if (compact) root.setAttribute('data-density', 'compact');
  else root.removeAttribute('data-density');
};

/** Run once before the first render to avoid a flash of the wrong theme/density. */
export const applyCachedDisplay = (): void => applyDisplay(readDisplayCache());
