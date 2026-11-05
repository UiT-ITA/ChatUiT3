import type React from 'react';
import { useTranslation } from 'react-i18next';
import type { DataClassification } from '../../types/modelModels';
import { cx, splitLayoutProps, type LayoutProps } from '../common/layout';
import './ClassificationBadge.css';

interface ClassificationBadgeProps extends LayoutProps {
  classification: DataClassification;
  className?: string;
  style?: React.CSSProperties;
  // Draws the level's name in the main text color
  strong?: boolean;
  /** Shows the level and what it means as a tooltip. On by default. */
  showTitle?: boolean;
  /** Shows only the dot; the level's name stays for screen readers. */
  dotOnly?: boolean;
}

/** A neutral pill with a dot in the classification's colour, then the level's name. */
export default function ClassificationBadge({ classification, className, showTitle = true, strong = false, dotOnly = false, ...props }: ClassificationBadgeProps) {
  const [style] = splitLayoutProps(props);
  const { t } = useTranslation();
  const level = t(`classification.${classification}`);
  const description = t(`classification.descriptions.${classification}`);

  return (
    <span
      className={cx('classification-badge', 't-status', strong && 'classification-badge--strong', dotOnly && 'classification-badge--dot-only', className)}
      style={style}
      title={showTitle ? t('classification.titleWithDescription', { level, description }) : undefined}
    >
      <span className={`classification-dot classification-${classification.toLowerCase()}`} aria-hidden="true" />
      <span className={cx(dotOnly && 'classification-badge__label--hidden')}>{level}</span>
    </span>
  );
}
