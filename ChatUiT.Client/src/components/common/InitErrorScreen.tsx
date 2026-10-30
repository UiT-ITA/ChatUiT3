import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from './Button';
import Stack from './Stack';
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
      <Stack direction="row" gap="md" mt="sm">
        <Button variant="primary" onClick={onRetry}>
          {t('initError.retry')}
        </Button>
        <Button variant="subtle" onClick={onSignOut}>
          {t('initError.signOut')}
        </Button>
      </Stack>
    </div>
  );
};

export default InitErrorScreen;
