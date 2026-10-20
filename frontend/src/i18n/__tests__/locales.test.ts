import { describe, it, expect } from 'vitest';
import en from '../locales/en.json';
import ar from '../locales/ar.json';

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ''): [string, string][] =>
  Object.entries(tree).flatMap(([key, value]): [string, string][] => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [[path, value]] : flatten(value, path);
  });

const enFlat = Object.fromEntries(flatten(en as Tree));
const arFlat = Object.fromEntries(flatten(ar as Tree));

// i18next plural keys: "minutes_one", "minutes_other", ... English has two forms, Arabic has six.
// Matches a plural suffix at the end of a key: "a.minutes_few" -> "_few"; "a.minutes" -> no match
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const AR_PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'];
const baseKey = (key: string): string => key.replace(PLURAL_SUFFIX, '');
const baseKeys = (flat: Record<string, string>): string[] => [...new Set(Object.keys(flat).map(baseKey))].sort();

// Matches i18next placeholders: "Hello {{name}}" -> ["{{name}}"]; "plain text" -> no match
// https://regex101.com/?regex=%5C%7B%5C%7B%5Cs*%5Cw%2B%5Cs*%5C%7D%5C%7D&flags=g&testString=Hello%20%7B%7Bname%7D%7D%0Aplain%20text
const PLACEHOLDER = /\{\{\s*\w+\s*\}\}/g;
// Matches simple <Trans> tags: "<strong>x</strong>" -> ["<strong>", "</strong>"]; "a < b" -> no match
// https://regex101.com/?regex=%3C%5C%2F%3F%5Cw%2B%3E&flags=g&testString=%3Cstrong%3Ex%3C%2Fstrong%3E%0Aa%20%3C%20b
const TAG = /<\/?\w+>/g;

const tokens = (text: string): string[] =>
  [...(text.match(PLACEHOLDER) ?? []), ...(text.match(TAG) ?? [])].sort();

describe('locale files', () => {
  it('en.json and ar.json have identical key sets', () => {
    const enKeys = baseKeys(enFlat);
    const arKeys = baseKeys(arFlat);
    expect(arKeys.filter((k) => !enKeys.includes(k))).toEqual([]); // only in ar
    expect(enKeys.filter((k) => !arKeys.includes(k))).toEqual([]); // only in en
    expect(arKeys).toEqual(enKeys);
  });

  it('defines every Arabic plural form for each plural key', () => {
    const pluralBases = [...new Set(Object.keys(arFlat).filter((k) => PLURAL_SUFFIX.test(k)).map(baseKey))];
    const incomplete = pluralBases.filter((base) => AR_PLURAL_FORMS.some((form) => !(`${base}_${form}` in arFlat)));
    expect(incomplete).toEqual([]);
  });

  it('has no empty translations', () => {
    const empty = [...Object.entries(enFlat), ...Object.entries(arFlat)]
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('uses the same interpolation placeholders and tags in both languages', () => {
    // Plural variants such as "one" and "two" may omit {{count}} on purpose, so compare the general forms only.
    const comparable = Object.keys(enFlat).filter((key) => !PLURAL_SUFFIX.test(key) || key.endsWith('_other'));
    const mismatched = comparable.filter(
      (key) => JSON.stringify(tokens(enFlat[key])) !== JSON.stringify(tokens(arFlat[key] ?? '')),
    );
    expect(mismatched).toEqual([]);
  });
});

describe('Arabic plurals', () => {
  it.each([
    [1, 'منذ دقيقة'],
    [2, 'منذ دقيقتين'],
    [5, 'منذ 5 دقائق'],
    [11, 'منذ 11 دقيقة'],
  ])('incidents.minutesAgo with count %i renders "%s"', async (count, expected) => {
    const { default: i18n } = await import('i18next');
    await import('..');
    expect(i18n.t('incidents.minutesAgo', { count, lng: 'ar' })).toBe(expected);
  });
});
