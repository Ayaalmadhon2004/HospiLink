// Shared date/time formatting: honours the user's timezone setting and the active UI language.
import i18n from '../i18n';

export const DEFAULT_TIMEZONE = 'UTC';

let currentTimezone: string = DEFAULT_TIMEZONE;

export const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

/** Called by SettingsProvider when the user's timezone setting changes. */
export const setActiveTimezone = (tz: string | null | undefined): void => {
  currentTimezone = tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
};

export const getActiveTimezone = (): string => currentTimezone;

/** IANA zones offered in the settings select (UTC always first). */
export const getTimezoneOptions = (): string[] => {
  const zones = ((): string[] => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    } catch {
      return [];
    }
  })();
  return ['UTC', ...zones.filter((z) => z !== 'UTC')];
};

type DateInput = string | number | Date | null | undefined;

const format = (value: DateInput, options: Intl.DateTimeFormatOptions, fallback: string): string => {
  if (value === null || value === undefined || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(i18n.language || 'en', { timeZone: currentTimezone, ...options }).format(date);
};

export const formatDate = (
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' },
  fallback = '',
): string => format(value, options, fallback);

export const formatTime = (
  value: DateInput,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
  fallback = '',
): string => format(value, options, fallback);

export const formatDateTime = (
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  },
  fallback = '',
): string => format(value, options, fallback);
