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
    const enKeys = Object.keys(enFlat).sort();
    const arKeys = Object.keys(arFlat).sort();
    expect(arKeys.filter((k) => !(k in enFlat))).toEqual([]); // only in ar
    expect(enKeys.filter((k) => !(k in arFlat))).toEqual([]); // only in en
    expect(arKeys).toEqual(enKeys);
  });

  it('has no empty translations', () => {
    const empty = [...Object.entries(enFlat), ...Object.entries(arFlat)]
      .filter(([, value]) => value.trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it('uses the same interpolation placeholders and tags in both languages', () => {
    const mismatched = Object.keys(enFlat).filter(
      (key) => JSON.stringify(tokens(enFlat[key])) !== JSON.stringify(tokens(arFlat[key] ?? '')),
    );
    expect(mismatched).toEqual([]);
  });
});
