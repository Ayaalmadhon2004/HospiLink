import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import en from '../locales/en.json';
import ar from '../locales/ar.json';
import { ENUM_KEYS, enumLabel, type EnumGroup } from '../../utils/enumLabel';

type Tree = { [key: string]: string | Tree };

const flatten = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]): string[] => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string' ? [path] : flatten(value, path);
  });

const enKeys = new Set(flatten(en as Tree));
const arKeys = new Set(flatten(ar as Tree));
const TOP_GROUPS = new Set(Object.keys(en));

const PLURAL = ['zero', 'one', 'two', 'few', 'many', 'other'];
/** A key exists directly, or through i18next plural variants (`key_one`, `key_other`...). */
const exists = (keys: Set<string>, key: string): boolean => keys.has(key) || PLURAL.some((p) => keys.has(`${key}_${p}`));
const isPrefix = (keys: Set<string>, prefix: string): boolean => [...keys].some((k) => k.startsWith(`${prefix}.`));

// All application sources (tests excluded), read as text by Vite.
const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
const appSources = Object.entries(sources).filter(
  ([path]) => !/\/(__tests__|test)\//.test(path) && !/\.test\.tsx?$/.test(path) && !path.includes('/i18n/'),
);

// t('a.b'), t("a.b"), i18n.t('a.b'), i18nKey="a.b"
const STATIC_KEY = /(?:\bt|i18n\.t)\(\s*['"]([A-Za-z0-9_.]+)['"]|i18nKey=["']([A-Za-z0-9_.]+)["']/g;
// t(`a.b.${x}`) -> prefix "a.b"
const DYNAMIC_KEY = /(?:\bt|i18n\.t)\(\s*`([A-Za-z0-9_.]+)\.\$\{/g;
// Config files store keys (not text) as labels: 'forms.patient.name'
const CONFIG_KEY = /['"]((?:[a-z][A-Za-z0-9]*)(?:\.[A-Za-z0-9_]+)+)['"]/g;
const CONFIG_FILES = /\/src\/(configs|constants)\//;

const usedKeys = (): { file: string; key: string }[] => {
  const out: { file: string; key: string }[] = [];
  for (const [file, text] of appSources) {
    for (const m of text.matchAll(STATIC_KEY)) {
      const key = m[1] ?? m[2];
      if (key.includes('.')) out.push({ file, key });
    }
    if (CONFIG_FILES.test(file)) {
      for (const m of text.matchAll(CONFIG_KEY)) {
        if (TOP_GROUPS.has(m[1].split('.')[0])) out.push({ file, key: m[1] });
      }
    }
  }
  return out;
};

describe('translation keys used in the code', () => {
  it('finds a meaningful number of t() calls (guards against the scan silently breaking)', () => {
    expect(usedKeys().length).toBeGreaterThan(300);
  });

  it('every static key exists in en.json and ar.json', () => {
    const missing = usedKeys()
      .filter(({ key }) => !exists(enKeys, key) || !exists(arKeys, key))
      .map(({ file, key }) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });

  it('every dynamic key prefix (t(`a.b.${x}`)) is a group in both locale files', () => {
    const missing: string[] = [];
    for (const [file, text] of appSources) {
      for (const m of text.matchAll(DYNAMIC_KEY)) {
        if (!isPrefix(enKeys, m[1]) || !isPrefix(arKeys, m[1])) missing.push(`${file}: ${m[1]}.*`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('hardcoded user-visible text', () => {
  const tsx = appSources.filter(([path]) => path.endsWith('.tsx'));
  // Text between tags that is not an expression: ">Save<". Brand name and symbols are fine.
  const JSX_TEXT = />\s*([A-Za-z][^<>{}\n]*[A-Za-z])\s*</g;
  const ATTRIBUTE = /\b(?:aria-label|aria-description|title|placeholder|alt)="([A-Za-z][^"]*)"/g;
  // HospiLink: brand; English: the language's own name; Promise/extractList: generics and calls matched by the regex, not text.
  const ALLOWED = new Set(['HospiLink', 'English', 'Promise', 'extractList']);
  const isAllowed = (text: string): boolean => ALLOWED.has(text) || /^\S+@\S+$/.test(text);

  it('has no literal English text in JSX', () => {
    const found = tsx.flatMap(([file, text]) =>
      [...text.matchAll(JSX_TEXT)].filter((m) => !isAllowed(m[1]) && !/=>|&&|\|\||\?|:\s*$/.test(m[1])).map((m) => `${file}: ${m[1]}`),
    );
    expect(found).toEqual([]);
  });

  it('has no literal English aria-label / title / placeholder / alt attributes', () => {
    const found = tsx.flatMap(([file, text]) =>
      [...text.matchAll(ATTRIBUTE)].filter((m) => !isAllowed(m[1])).map((m) => `${file}: ${m[1]}`),
    );
    expect(found).toEqual([]);
  });
});

// Arabic values identical to English are almost always an untranslated copy-paste. Brand names,
// units, codes and the language's own name are legitimate and listed here.
const withoutPlaceholders = (text: string): string => text.replace(/\{\{\s*\w+\s*\}\}/g, '');
const SAME_IN_BOTH = /^(\S+@\S+|HospiLink|English|العربية|SpO2|SpO₂|PDF|Excel|ID|%|\W*|[A-Z0-9 ._/-]{1,6})$/;

describe('Arabic coverage', () => {
  it('has no value that is still the English text', () => {
    const enFlat = flattenValues(en as Tree);
    const arFlat = flattenValues(ar as Tree);
    const same = Object.keys(enFlat).filter(
      (k) => arFlat[k] !== undefined && arFlat[k] === enFlat[k] && /[A-Za-z]{3,}/.test(withoutPlaceholders(enFlat[k])) && !SAME_IN_BOTH.test(enFlat[k]),
    );
    expect(same).toEqual([]);
  });
});

function flattenValues(tree: Tree, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tree).flatMap(([key, value]): [string, string][] => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === 'string' ? [[path, value]] : Object.entries(flattenValues(value, path));
    }),
  );
}

// ---------------------------------------------------------------------------------------------
// Enum labels vs the Prisma schema (read-only text of the backend)
// ---------------------------------------------------------------------------------------------
const schema = readFileSync(resolve(process.cwd(), '../backend/prisma/schema.prisma'), 'utf8');

const prismaEnum = (name: string): string[] => {
  const body = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema)?.[1] ?? '';
  return body
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .flatMap((line) => line.split(/\s+/));
};

const GROUP_TO_PRISMA: Partial<Record<EnumGroup, string>> = {
  role: 'Role',
  accountStatus: 'AccountStatus',
  patientStatus: 'PatientStatus',
  gender: 'Gender',
  shiftType: 'ShiftType',
  dutyStatus: 'DutyStatus',
  appointmentType: 'AppointmentType',
  appointmentStatus: 'AppointmentStatus',
  incidentType: 'IncidentType',
  incidentSeverity: 'IncidentSeverity',
  incidentStatus: 'IncidentStatus',
  bedStatus: 'BedStatus',
  unitType: 'UnitType',
  unitStatus: 'UnitStatus',
  callStatus: 'CallStatus',
  priority: 'Priority',
  noteType: 'NoteType',
  labPriority: 'LabPriority',
  labStatus: 'LabOrderStatus',
  labFlag: 'LabFlag',
  prescriptionStatus: 'PrescriptionStatus',
  invoiceStatus: 'InvoiceStatus',
  paymentMethod: 'PaymentMethod',
  stockMovement: 'StockMovementType',
  authTokenType: 'AuthTokenType',
};

describe('enum labels', () => {
  it.each(Object.entries(GROUP_TO_PRISMA))('%s has a label in both languages for every %s value', (group, prismaName) => {
    const values = prismaEnum(prismaName as string);
    expect(values.length).toBeGreaterThan(1);
    const prefix = ENUM_KEYS[group as EnumGroup];
    const missingEn = values.filter((v) => !enKeys.has(`${prefix}.${v}`));
    const missingAr = values.filter((v) => !arKeys.has(`${prefix}.${v}`));
    expect({ missingEn, missingAr }).toEqual({ missingEn: [], missingAr: [] });
  });

  it('audit actions cover every logActivity() name of the backend', () => {
    const names = new Set<string>();
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (full.endsWith('.ts')) {
          for (const m of readFileSync(full, 'utf8').matchAll(/logActivity\(\s*'([A-Z0-9_]+)'/g)) names.add(m[1]);
        }
      }
    };
    walk(resolve(process.cwd(), '../backend/src'));
    expect(names.size).toBeGreaterThan(40);
    const missing = [...names].filter((n) => !enKeys.has(`enums.auditAction.${n}`) || !arKeys.has(`enums.auditAction.${n}`));
    expect(missing).toEqual([]);
  });

  it('translates known values and falls back to the raw value for unknown ones', async () => {
    const { default: i18n } = await import('i18next');
    await import('..');
    await i18n.changeLanguage('ar');
    expect(enumLabel(i18n.t, 'role', 'NURSE')).toBe('ممرض');
    expect(enumLabel(i18n.t, 'role', 'SOMETHING_NEW')).toBe('SOMETHING_NEW');
    expect(enumLabel(i18n.t, 'role', null)).toBe('');
    await i18n.changeLanguage('en');
    expect(enumLabel(i18n.t, 'invoiceStatus', 'PAID')).toBe('Paid');
  });
});

// ---------------------------------------------------------------------------------------------
// Backend error codes vs errors.codes
// ---------------------------------------------------------------------------------------------
import { readdirSync } from 'node:fs';

const backendSrc = resolve(process.cwd(), '../backend/src');

const backendCodes = (): Set<string> => {
  const codes = new Set<string>();
  const apiResponse = readFileSync(resolve(backendSrc, 'utils/apiResponse.ts'), 'utf8');
  const union = /export type ErrorCode =([^;]*);/.exec(apiResponse)?.[1] ?? '';
  for (const m of union.matchAll(/'([A-Z][A-Z0-9_]+)'/g)) codes.add(m[1]);
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (full.endsWith('.ts')) {
        const text = readFileSync(full, 'utf8');
        for (const m of text.matchAll(/\bfail\(\s*\w+\s*,\s*\d+\s*,\s*'([A-Z][A-Z0-9_]+)'/g)) codes.add(m[1]);
        for (const m of text.matchAll(/\bcode:\s*'([A-Z][A-Z0-9_]+)'/g)) codes.add(m[1]);
      }
    }
  };
  walk(backendSrc);
  return codes;
};

describe('backend error codes', () => {
  it('every ErrorCode and every code passed to fail() has a translation in both languages', () => {
    const codes = backendCodes();
    expect(codes.size).toBeGreaterThan(25);
    const missing = [...codes].filter((c) => !enKeys.has(`errors.codes.${c}`) || !arKeys.has(`errors.codes.${c}`));
    expect(missing).toEqual([]);
  });
});
