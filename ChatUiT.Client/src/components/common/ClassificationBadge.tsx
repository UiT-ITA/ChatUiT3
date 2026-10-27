import { useTranslation } from 'react-i18next';
import { DATA_CLASSIFICATIONS, type DataClassification } from '../../types/modelModels';
import './ClassificationBadge.css';

interface ClassificationBadgeProps {
  classification: DataClassification;
  className?: string;
}

/** One overlapping circle per level up to the classification, then the level's name. */
export default function ClassificationBadge({ classification, className }: ClassificationBadgeProps) {
  const { t } = useTranslation();
  const level = t(`classification.${classification}`);
  const levels = DATA_CLASSIFICATIONS.slice(0, DATA_CLASSIFICATIONS.indexOf(classification) + 1);

  return (
    <span
      className={`classification-badge t-meta ${className ?? ''}`}
      title={t('classification.title', { level })}
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
