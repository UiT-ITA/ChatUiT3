import React from 'react';
import { useTranslation } from 'react-i18next';
import './LoadingIndicator.css';

/** A spinning ring with a line of text under it, centred in the view. */
const LoadingIndicator: React.FC<{ text?: string }> = ({ text }) => {
  const { t } = useTranslation();
  return (
    <div className="loading-container">
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
      </div>
      <div className="t-caption">{text || t('common.loading')}</div>
    </div>
  );
};

export default LoadingIndicator;
