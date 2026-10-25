/**
 * Local-calendar helpers for "from day / to day" pickers (<input type="date"> gives "YYYY-MM-DD").
 * The API takes instants with an EXCLUSIVE end, so "to Jan 31" means "before the start of Feb 1".
 */
export const dayStartIso = (day: string): string => new Date(`${day}T00:00:00`).toISOString();

export const nextDayStartIso = (day: string): string => {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
};

/** The picker value ("YYYY-MM-DD", local) of an instant, or '' when there is none. */
export const toDayValue = (iso?: string): string => (iso ? new Date(iso).toLocaleDateString('en-CA') : '');

/** The last day INCLUDED by an exclusive end instant (what the user picked as "to"). */
export const lastIncludedDayValue = (exclusiveEndIso?: string): string =>
  exclusiveEndIso ? toDayValue(new Date(new Date(exclusiveEndIso).getTime() - 1).toISOString()) : '';
