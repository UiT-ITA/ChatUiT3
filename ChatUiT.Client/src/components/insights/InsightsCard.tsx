import React from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Text from '../common/Text';
import EmptyNote from '../common/EmptyNote';
import { cx } from '../common/layout';
import type { InsightsTable } from '../../types/insights';
import './InsightsCard.css';

interface InsightsCardProps {
  title: string;
  // The query results the card shows. Undefined while they load.
  tables: (InsightsTable | undefined)[];
  // Spans the whole width of the card grid
  wide?: boolean;
  // Renders the content once every table has loaded without an error and one has rows
  children: () => React.ReactNode;
}

/** A titled card of the Insights page that shows loading, failed and empty states in place of its content. */
const InsightsCard: React.FC<InsightsCardProps> = ({ title, tables, wide = false, children }) => {
  const { t } = useTranslation();
  const error = tables.find(table => table?.error)?.error;
  const loading = tables.some(table => table === undefined);
  const empty = !loading && tables.every(table => table?.rows.length === 0);

  return (
    <Card as="section" padding="lg" gap="md" className={cx('insights-card', wide && 'insights-card--wide')}>
      <Text as="h2" variant="overline" tone="muted">{title}</Text>
      {error ? (
        <Text as="p" variant="body" tone="danger">{t(`insights.errors.${error}`)}</Text>
      ) : loading ? (
        <EmptyNote variant="row">{t('common.loading')}</EmptyNote>
      ) : empty ? (
        <EmptyNote variant="row">{t('insights.empty')}</EmptyNote>
      ) : (
        children()
      )}
    </Card>
  );
};

export default InsightsCard;
