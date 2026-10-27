import React from 'react';
import { useTranslation } from 'react-i18next';
import './LoadingIndicator.css';

interface LoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  showText?: boolean;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  size = 'medium',
  text,
  showText = true
}) => {
  const { t } = useTranslation();
  const displayText = text || t('common.loading');
  return (
    <div className={`loading-container loading-${size}`}>
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
      </div>
      {showText && <div className="loading-text t-caption">{displayText}</div>}
    </div>
  );
};

export default LoadingIndicator;
