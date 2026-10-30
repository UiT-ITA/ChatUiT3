import type React from 'react';
import { useTranslation } from 'react-i18next';
import { DATA_CLASSIFICATIONS, type DataClassification } from '../../types/modelModels';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import './ClassificationBadge.css';

interface ClassificationBadgeProps extends LayoutProps {
  classification: DataClassification;
  className?: string;
  style?: React.CSSProperties;
  // Draws the level's name in the main text color
  strong?: boolean;
  /** Shows the level as a tooltip. On by default. */
  showTitle?: boolean;
}

/** One overlapping circle per level up to the classification, then the level's name. */
export default function ClassificationBadge({ classification, className, showTitle = true, strong = false, ...props }: ClassificationBadgeProps) {
  const [style] = splitLayoutProps(props);
  const { t } = useTranslation();
  const level = t(`classification.${classification}`);
  const levels = DATA_CLASSIFICATIONS.slice(0, DATA_CLASSIFICATIONS.indexOf(classification) + 1);

  return (
    <span
      className={cx('classification-badge', 't-meta', strong && 'classification-badge--strong', className)}
      style={style}
      title={showTitle ? t('classification.title', { level }) : undefined}
    >
      <span className="classification-dots" aria-hidden="true">
        {levels.map(l => (
          <span key={l} className={`classification-dot classification-${l.toLowerCase()}`} />
        ))}
      </span>
      {level}
    </span>
  );
}
