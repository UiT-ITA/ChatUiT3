import { signal } from '@preact/signals-react';
import apiService from './apiService';
import { DEFAULT_INSIGHTS_RANGE, type InsightsPageResult, type InsightsRange, type InsightsTab } from '../types/insights';

/** The time range the Insights page shows, kept while the admin moves between its tabs. */
export const insightsRangeSignal = signal<InsightsRange>(DEFAULT_INSIGHTS_RANGE);

/** Every query result of an Insights page over a time range. Admins only. */
export async function getInsightsPage(page: InsightsTab, range: InsightsRange): Promise<InsightsPageResult> {
  return apiService<InsightsPageResult>(`/api/insights/${page}?range=${range}`);
}
