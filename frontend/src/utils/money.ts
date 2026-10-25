import i18n from '../i18n';

/** Every amount in the API is an integer in minor units (cents). Currencies with other exponents are not supported yet. */
export const MINOR_PER_MAJOR = 100;

export const formatMoney = (minor: number, currency = 'USD'): string => {
  try {
    return new Intl.NumberFormat(i18n.language || 'en', { style: 'currency', currency }).format(minor / MINOR_PER_MAJOR);
  } catch {
    return `${(minor / MINOR_PER_MAJOR).toFixed(2)} ${currency}`; // unknown currency code
  }
};

/**
 * "12.5" -> 1250. Returns null for anything that is not a non-negative amount with at most 2 decimals,
 * so a typo never turns into a different price.
 */
export const parseMajorToMinor = (input: string): number | null => {
  const m = /^\s*(\d+)(?:[.,](\d{1,2}))?\s*$/.exec(input);
  if (!m) return null;
  return Number(m[1]) * MINOR_PER_MAJOR + Number((m[2] ?? '').padEnd(2, '0') || 0);
};
