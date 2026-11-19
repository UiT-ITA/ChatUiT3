import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import Stack from '../common/Stack';
import Text from '../common/Text';

/** Shows its children to an admin. */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <Stack p="xl" gap="sm">
        <Text as="h2" variant="page-title">{t('auth.accessDenied')}</Text>
        <Text as="p" variant="body">{t('auth.noPermission')}</Text>
      </Stack>
    );
  }
  return <>{children}</>;
};

export default ProtectedRoute;
