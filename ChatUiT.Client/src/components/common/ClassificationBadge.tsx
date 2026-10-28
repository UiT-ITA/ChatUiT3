import { useTranslation } from 'react-i18next';
import { DATA_CLASSIFICATIONS, type DataClassification } from '../../types/modelModels';
import './ClassificationBadge.css';

interface ClassificationBadgeProps {
  classification: DataClassification;
  className?: string;
  /** Shows the level as a tooltip. On by default. */
  showTitle?: boolean;
}

/** One overlapping circle per level up to the classification, then the level's name. */
export default function ClassificationBadge({ classification, className, showTitle = true }: ClassificationBadgeProps) {
  const { t } = useTranslation();
  const level = t(`classification.${classification}`);
  const levels = DATA_CLASSIFICATIONS.slice(0, DATA_CLASSIFICATIONS.indexOf(classification) + 1);

  return (
    <span
      className={`classification-badge t-meta ${className ?? ''}`}
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
