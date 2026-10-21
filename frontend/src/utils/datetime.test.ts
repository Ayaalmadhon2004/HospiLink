import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import {
  formatDate,
  formatDateTime,
  formatTime,
  getTimezoneOptions,
  isValidTimezone,
  setActiveTimezone,
  getActiveTimezone,
} from './datetime';

const ISO = '2026-03-10T23:30:00Z';

describe('datetime helpers', () => {
  afterEach(() => setActiveTimezone('UTC'));

  it('formats in the selected timezone', () => {
    setActiveTimezone('UTC');
    expect(formatTime(ISO)).toBe('11:30 PM');
    setActiveTimezone('Asia/Amman'); // UTC+2/+3 -> next day
    expect(formatDate(ISO, { day: 'numeric', month: 'numeric' })).toBe('3/11');
    expect(formatDateTime(ISO)).toContain('3/11/2026');
  });

  it('uses the active UI language', async () => {
    await i18n.changeLanguage('ar');
    expect(formatDate(ISO, { month: 'long' })).toBe(new Intl.DateTimeFormat('ar', { month: 'long', timeZone: 'UTC' }).format(new Date(ISO)));
  });

  it('returns the fallback for empty or invalid input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatTime('garbage', undefined, '--')).toBe('--');
    expect(formatDateTime(undefined, undefined, 'n/a')).toBe('n/a');
  });

  it('ignores invalid timezones', () => {
    setActiveTimezone('Mars/Olympus');
    expect(getActiveTimezone()).toBe('UTC');
    expect(isValidTimezone('Europe/London')).toBe(true);
    expect(isValidTimezone('nope')).toBe(false);
  });

  it('lists UTC first and no duplicates', () => {
    const zones = getTimezoneOptions();
    expect(zones[0]).toBe('UTC');
    expect(new Set(zones).size).toBe(zones.length);
  });
});
