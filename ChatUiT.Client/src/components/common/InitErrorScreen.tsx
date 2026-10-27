import React from 'react';
import { useTranslation } from 'react-i18next';
import './InitErrorScreen.css';

interface InitErrorScreenProps {
  message?: string;
  onRetry: () => void;
  onSignOut: () => void;
}

const InitErrorScreen: React.FC<InitErrorScreenProps> = ({ message, onRetry, onSignOut }) => {
  const { t } = useTranslation();
  return (
    <div className="init-error-container">
      <div className="init-error-title">{t('initError.title')}</div>
      {message && <div className="init-error-message t-caption">{message}</div>}
      <div className="init-error-actions">
        <button className="init-error-retry" onClick={onRetry}>
          {t('initError.retry')}
        </button>
        <button className="init-error-signout" onClick={onSignOut}>
          {t('initError.signOut')}
        </button>
      </div>
    </div>
  );
};

export default InitErrorScreen;
