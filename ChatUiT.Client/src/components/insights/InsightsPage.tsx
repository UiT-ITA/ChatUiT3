import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { getInsightsPage, insightsRangeSignal } from '../../services/insightsService';
import { INSIGHTS_RANGES, INSIGHTS_TABS, isInsightsTab, type InsightsPageResult, type InsightsRange, type InsightsRow, type InsightsTab, type InsightsTable } from '../../types/insights';
import Page, { PageIntro } from '../common/Page';
import PageTitleBar from '../common/PageTitleBar';
import Text from '../common/Text';
import Card from '../common/Card';
import Table from '../common/Table';
import StackedBar from '../common/StackedBar';
import SegmentedControl from '../common/SegmentedControl';
import { Legend, LegendItem } from '../common/Legend';
import type { DataTone } from '../common/dataTone';
import InsightsCard from './InsightsCard';
import TimeChart from './TimeChart';
import BarList from './BarList';
import { formatDateTime, formatMs, formatNumber, formatShare, num, rowsOf, text } from './insightsFormat';
import './InsightsPage.css';

const MIX_TONES: DataTone[] = ['viz-1', 'viz-2', 'viz-3', 'viz-4', 'viz-5'];
const MIX_DIMENSIONS = ['redChat', 'classification', 'reasoningEffort', 'attachments'] as const;
const MIX_VALUES = ['on', 'off', 'unknown', 'none', 'with', 'without'];

interface Loaded {
  key: string;
  result?: InsightsPageResult;
  failed?: boolean;
}

/** The admin-only telemetry dashboard: one page per tab, read live from Application Insights over the chosen range. */
const InsightsPage: React.FC = () => {
  useSignals();
  const { t, i18n } = useTranslation();
  const { tab } = useParams<{ tab?: string }>();
  const range = insightsRangeSignal.value;
  const activeTab: InsightsTab = isInsightsTab(tab) ? tab : INSIGHTS_TABS[0];
  const key = `${activeTab}:${range}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    getInsightsPage(activeTab, range)
      .then(result => { if (!cancelled) setLoaded({ key, result }); })
      .catch(() => { if (!cancelled) setLoaded({ key, failed: true }); });
    return () => { cancelled = true; };
  }, [activeTab, range, key]);

  if (tab !== undefined && !isInsightsTab(tab)) {
    return <Navigate to="/insights" replace />;
  }

  const current = loaded?.key === key ? loaded : undefined;
  const table = (name: string): InsightsTable | undefined =>
    current?.failed ? { columns: [], rows: [], error: 'request' } : current?.result?.tables[name];
  const lang = i18n.language;
  const n = (value: unknown, digits = 0) => formatNumber(value, lang, digits);
  const ms = (value: unknown) => formatMs(value, lang);
  const when = (value: unknown) => formatDateTime(value, lang);
  const blank = (value: unknown) => text(value) || '—';

  /** A card with a table of the rows of one query. */
  const tableCard = (title: string, name: string, columns: string[], cells: (row: InsightsRow) => React.ReactNode[], keyOf: (row: InsightsRow, index: number) => string, minWidth: 'md' | 'lg' | 'xl' = 'xl') => (
    <InsightsCard key={name} title={title} tables={[table(name)]} wide>
      {() => (
        <div className="insights-table">
          <Table
            minWidth={minWidth}
            columns={columns.map(column => t(`insights.columns.${column}`))}
            rows={rowsOf(table(name)).map((row, index) => ({ key: keyOf(row, index), cells: cells(row) }))}
          />
        </div>
      )}
    </InsightsCard>
  );

  /** A card of headline figures from the one row of a query. */
  const statsCard = (name: string, stats: { key: string; digits?: number }[]) => (
    <InsightsCard key={name} title={t('insights.cards.summary')} tables={[table(name)]} wide>
      {() => {
        const row = rowsOf(table(name))[0];
        return (
          <div className="insights-stats">
            {stats.map(stat => (
              <Card key={stat.key} padding="md" gap="xs">
                <Text variant="label" tone="muted">{t(`insights.stats.${stat.key}`)}</Text>
                <Text variant="page-title" numeric>{n(row?.[stat.key], stat.digits)}</Text>
              </Card>
            ))}
          </div>
        );
      }}
    </InsightsCard>
  );

  const appLabel = (value: unknown) => (text(value) === 'not tagged' ? t('insights.notTagged') : text(value));

  const usage = () => {
    const mix = rowsOf(table('messageMix'));
    const mixValue = (value: unknown, dimension?: string) =>
      MIX_VALUES.includes(text(value)) ? t(`insights.mixValues.${text(value)}`)
        : dimension === 'classification' ? t(`classification.${text(value)}`, { defaultValue: text(value) })
        : text(value);
    return (
      <>
        {statsCard('headline', [{ key: 'users' }, { key: 'sessions' }, { key: 'messagesPerUser', digits: 1 }, { key: 'chats' }, { key: 'toolCalls' }])}
        <InsightsCard title={t('insights.cards.activeUsers')} tables={[table('activity')]} wide>
          {() => (
            <TimeChart rows={rowsOf(table('activity'))} x="at" range={range} series={[
              { key: 'users', label: t('insights.series.users'), tone: 'viz-1', summary: 'peak' },
            ]} />
          )}
        </InsightsCard>
        <InsightsCard title={t('insights.cards.messagesAndTools')} tables={[table('activity')]} wide>
          {() => (
            <TimeChart rows={rowsOf(table('activity'))} x="at" range={range} series={[
              { key: 'messages', label: t('insights.series.messages'), tone: 'viz-2', summary: 'total' },
              { key: 'toolCalls', label: t('insights.series.toolCalls'), tone: 'viz-4', summary: 'total' },
            ]} />
          )}
        </InsightsCard>
        {tableCard(t('insights.cards.users'), 'users',
          ['user', 'messages', 'chats', 'sessions', 'toolCalls', 'tokens', 'topModel', 'clients', 'lastSeen'],
          row => [
            text(row.upn) || t('insights.noUpn', { id: text(row.uid).slice(0, 8) }),
            n(row.messages), n(row.chats), n(row.sessions), n(row.toolCalls), n(row.tokens), blank(row.topModel),
            (Array.isArray(row.apps) ? row.apps : []).map(appLabel).join(', ') || '—',
            when(row.lastSeen),
          ],
          row => text(row.uid))}
        <InsightsCard title={t('insights.cards.clients')} tables={[table('clients')]}>
          {() => <BarList items={rowsOf(table('clients')).map(row => ({ key: text(row.app), label: appLabel(row.app), value: num(row.users), detail: t('insights.sessionsCount', { count: num(row.sessions) }) }))} />}
        </InsightsCard>
        <InsightsCard title={t('insights.cards.pages')} tables={[table('pages')]}>
          {() => <BarList items={rowsOf(table('pages')).map(row => ({ key: text(row.route), label: blank(row.route), value: num(row.pageViews), detail: t('insights.sessionsCount', { count: num(row.sessions) }) }))} />}
        </InsightsCard>
        <InsightsCard title={t('insights.cards.models')} tables={[table('models')]}>
          {() => <BarList items={rowsOf(table('models')).map(row => ({ key: text(row.model), label: blank(row.model), value: num(row.generations), detail: t('insights.usersCount', { count: num(row.users) }) }))} />}
        </InsightsCard>
        <InsightsCard title={t('insights.cards.features')} tables={[table('features')]}>
          {() => <BarList items={rowsOf(table('features')).map(row => ({ key: text(row.feature), label: t(`insights.features.${text(row.feature)}`, { defaultValue: text(row.feature) }), value: num(row.uses), detail: t('insights.usersCount', { count: num(row.users) }) }))} />}
        </InsightsCard>
        <InsightsCard title={t('insights.cards.messageMix')} tables={[table('messageMix')]} wide>
          {() => (
            <div className="insights-mix">
              {MIX_DIMENSIONS.map(dimension => {
                const values = mix.filter(row => row.dimension === dimension);
                const total = values.reduce((sum, row) => sum + num(row.messages), 0);
                return (
                  <section key={dimension} className="insights-mix__dimension">
                    <Text as="h3" variant="caption-strong">{t(`insights.mix.${dimension}`)}</Text>
                    <StackedBar scale="relative" segments={values.map((row, index) => ({ key: text(row.value), value: num(row.messages), tone: MIX_TONES[index % MIX_TONES.length] }))} />
                    <Legend>
                      {values.map((row, index) => (
                        <LegendItem key={text(row.value)} tone={MIX_TONES[index % MIX_TONES.length]} label={mixValue(row.value, dimension)} value={n(row.messages)} share={formatShare(total === 0 ? 0 : num(row.messages) / total, lang)} />
                      ))}
                    </Legend>
                  </section>
                );
              })}
              <section className="insights-mix__dimension">
                <Text as="h3" variant="caption-strong">{t('insights.mix.toolboxes')}</Text>
                <BarList items={mix.filter(row => row.dimension === 'toolboxes').map(row => ({ key: text(row.value), label: mixValue(row.value), value: num(row.messages) }))} />
              </section>
            </div>
          )}
        </InsightsCard>
        {tableCard(t('insights.cards.settings'), 'settings',
          ['setting', 'value', 'changes', 'users'],
          row => [text(row.setting), text(row.value), n(row.changes), n(row.users)],
          row => `${text(row.setting)}=${text(row.value)}`, 'md')}
      </>
    );
  };

  const models = () => (
    <>
      {statsCard('headline', [{ key: 'generations' }, { key: 'failedGenerations' }, { key: 'toolCalls' }, { key: 'failedToolCalls' }])}
      {tableCard(t('insights.cards.generations'), 'generations',
        ['model', 'generations', 'failed', 'firstToken', 'duration', 'toolRounds', 'tokensIn', 'tokensOut', 'tokensCached'],
        row => [blank(row.model), n(row.generations), n(row.failed), `${ms(row.p50FirstToken)} / ${ms(row.p95FirstToken)}`, `${ms(row.p50Duration)} / ${ms(row.p95Duration)}`, n(row.avgToolRounds, 1), n(row.tokensIn), n(row.tokensOut), n(row.tokensCached)],
        row => text(row.model))}
      {tableCard(t('insights.cards.tools'), 'tools',
        ['tool', 'toolbox', 'execution', 'calls', 'failed', 'duration'],
        row => [text(row.tool), text(row.toolbox) || t('insights.core'), blank(row.execution), n(row.calls), n(row.failed), `${ms(row.p50)} / ${ms(row.p95)}`],
        row => `${text(row.tool)}:${text(row.toolbox)}:${text(row.execution)}`, 'lg')}
    </>
  );

  const diagnostics = () => (
    <>
      {statsCard('headline', [{ key: 'clientErrors' }, { key: 'serverErrors' }, { key: 'failedRequests' }, { key: 'scannerProbes' }, { key: 'failedToolCalls' }])}
      <InsightsCard title={t('insights.cards.errorsOverTime')} tables={[table('errorsOverTime')]} wide>
        {() => (
          <TimeChart rows={rowsOf(table('errorsOverTime'))} x="at" range={range} series={[
            { key: 'client', label: t('insights.series.client'), tone: 'viz-3', summary: 'total' },
            { key: 'server', label: t('insights.series.server'), tone: 'viz-1', summary: 'total' },
          ]} />
        )}
      </InsightsCard>
      {tableCard(t('insights.cards.errors'), 'errors',
        ['source', 'event', 'detail', 'error', 'location', 'level', 'records', 'sessions', 'lastSeen'],
        row => [text(row.source), blank(row.event), blank(row.detail), blank(row.errorName), blank(row.location), text(row.level), n(row.records), n(row.sessions), when(row.lastSeen)],
        row => [row.source, row.event, row.detail, row.errorName, row.location, row.level].map(text).join('|'))}
      {tableCard(t('insights.cards.failedRequests'), 'failedRequests',
        ['request', 'status', 'requests', 'lastSeen'],
        row => [row.probe ? t('insights.probes') : text(row.request), text(row.resultCode), n(row.requests), when(row.lastSeen)],
        row => `${text(row.request)}:${text(row.resultCode)}:${text(row.probe)}`, 'md')}
      {tableCard(t('insights.cards.audit'), 'audit',
        ['event', 'detail', 'records', 'users', 'lastSeen'],
        row => [text(row.event), blank(row.detail), n(row.records), n(row.users), when(row.lastSeen)],
        row => `${text(row.event)}:${text(row.detail)}`, 'md')}
      {tableCard(t('insights.cards.clientVersions'), 'clientVersions',
        ['client', 'version', 'sessions', 'records', 'lastSeen'],
        row => [text(row.app), blank(row.version), n(row.sessions), n(row.records), when(row.lastSeen)],
        row => `${text(row.app)}:${text(row.version)}`, 'md')}
    </>
  );

  const logging = () => (
    <>
      {tableCard(t('insights.cards.volume'), 'volume',
        ['source', 'level', 'records', 'share'],
        row => [text(row.group) === 'category' ? blank(row.source) : t(`insights.volumeGroups.${text(row.group)}`), text(row.level), n(row.records), formatShare(num(row.share), lang)],
        row => `${text(row.group)}:${text(row.source)}:${text(row.level)}`, 'md')}
      {tableCard(t('insights.cards.events'), 'events',
        ['event', 'kind', 'records', 'sessions', 'failed', 'lastSeen'],
        row => [text(row.event), blank(row.eventKind), n(row.records), n(row.sessions), n(row.failed), when(row.lastSeen)],
        row => `${text(row.event)}:${text(row.eventKind)}`, 'md')}
    </>
  );

  const content: Record<InsightsTab, () => React.ReactNode> = { usage, models, diagnostics, logging };

  return (
    <Page width="wide">
      <Text as="h1" variant="page-title">{t(`insights.tabs.${activeTab}`)}</Text>
      <PageTitleBar />
      <PageIntro>{t('insights.intro')}</PageIntro>
      <div className="insights-toolbar">
        <SegmentedControl<InsightsRange>
          label={t('insights.range.label')}
          size="small"
          value={range}
          onChange={value => { insightsRangeSignal.value = value; }}
          options={INSIGHTS_RANGES.map(value => ({ value, label: t(`insights.range.${value}`) }))}
        />
        {current?.result && (
          <Text variant="caption" tone="muted">{t('insights.updated', { time: when(current.result.generatedAt) })}</Text>
        )}
      </div>
      <div className="insights-grid">
        {content[activeTab]()}
      </div>
    </Page>
  );
};

export default InsightsPage;
