import type { InsightsRange, InsightsRow, InsightsTable } from '../../types/insights';

/** The rows of a query result as objects keyed by column name. */
export const rowsOf = (table: InsightsTable | undefined): InsightsRow[] =>
  table?.rows.map(row => Object.fromEntries(table.columns.map((column, index) => [column.name, row[index]]))) ?? [];

/** A cell as a number, with 0 for a missing or non-numeric value. */
export const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** A cell as text, with an empty string for a missing value. */
export const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

export const formatNumber = (value: unknown, language: string, fractionDigits = 0): string =>
  value === null || value === undefined
    ? '—'
    : new Intl.NumberFormat(language, { maximumFractionDigits: fractionDigits, minimumFractionDigits: fractionDigits }).format(num(value));

/** Milliseconds as "850 ms" below a second and "1.8 s" from a second. */
export const formatMs = (value: unknown, language: string): string => {
  if (value === null || value === undefined) return '—';
  const ms = num(value);
  return ms < 1000 ? `${formatNumber(ms, language)} ms` : `${formatNumber(ms / 1000, language, 1)} s`;
};

export const formatShare = (value: number, language: string): string =>
  new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 1 }).format(value);

export const formatDateTime = (value: unknown, language: string): string =>
  value ? new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(text(value))) : '—';

/** The label of a time-series bucket: the time of day for ranges up to a day, the date for longer ones. */
export const formatBucket = (value: unknown, range: InsightsRange, language: string): string => {
  const date = new Date(text(value));
  return range === '1h' || range === '24h'
    ? new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(date)
    : range === '7d'
      ? new Intl.DateTimeFormat(language, { weekday: 'short', hour: '2-digit' }).format(date)
      : new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(date);
};
