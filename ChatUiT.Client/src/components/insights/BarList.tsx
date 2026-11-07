import React from 'react';
import { useTranslation } from 'react-i18next';
import StackedBar from '../common/StackedBar';
import Text from '../common/Text';
import { formatNumber } from './insightsFormat';
import './BarList.css';

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  // Text after the value, such as a second count
  detail?: string;
}

/** Rows of a label and a value over a bar sized against the largest value. */
const BarList: React.FC<{ items: BarListItem[] }> = ({ items }) => {
  const { i18n } = useTranslation();
  const max = Math.max(0, ...items.map(item => item.value));
  return (
    <ul className="bar-list">
      {items.map(item => (
        <li key={item.key} className="bar-list__row">
          <div className="bar-list__text">
            <Text variant="ui-plain" truncate title={item.label}>{item.label}</Text>
            <Text variant="table" numeric tone="secondary" wrap="nowrap">
              {formatNumber(item.value, i18n.language)}
              {item.detail && <Text variant="meta" tone="muted"> · {item.detail}</Text>}
            </Text>
          </div>
          <StackedBar segments={[{ key: 'value', value: max === 0 ? 0 : item.value / max, tone: 'viz-2' }]} />
        </li>
      ))}
    </ul>
  );
};

export default BarList;
