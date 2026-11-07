import type { IconName } from '../components/common/Icon';

export const INSIGHTS_TABS = ['usage', 'models', 'diagnostics', 'logging'] as const;

export type InsightsTab = (typeof INSIGHTS_TABS)[number];

export const INSIGHTS_TAB_ICONS: Record<InsightsTab, IconName> = {
  usage: 'people',
  models: 'cpu',
  diagnostics: 'error',
  logging: 'server',
};

export const isInsightsTab = (value: string | undefined): value is InsightsTab =>
  INSIGHTS_TABS.includes(value as InsightsTab);

export const INSIGHTS_RANGES = ['1h', '24h', '7d', '30d'] as const;

export type InsightsRange = (typeof INSIGHTS_RANGES)[number];

export const DEFAULT_INSIGHTS_RANGE: InsightsRange = '24h';

export interface InsightsColumn {
  name: string;
  // The Kusto type, such as string, long, real or datetime
  type: string;
}

/** The result of one query: its columns and rows, or the reason it failed. */
export interface InsightsTable {
  columns: InsightsColumn[];
  rows: unknown[][];
  // 'request' when the page request itself failed
  error?: 'not_configured' | 'no_access' | 'query_failed' | 'request' | null;
}

/** The results of every query of one Insights page for one time range. */
export interface InsightsPageResult {
  page: InsightsTab;
  range: InsightsRange;
  generatedAt: string;
  tables: Record<string, InsightsTable>;
}

/** A row of a query result as an object keyed by column name. */
export type InsightsRow = Record<string, unknown>;
