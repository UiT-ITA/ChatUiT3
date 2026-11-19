import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { ErrorCode, formatError } from '../../errors/errorCodes';
import Stack from '../common/Stack';
import Text from '../common/Text';

/** Shows its children to an admin. */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <Stack p="xl" gap="sm">
        <Text as="h2" variant="page-title">{formatError(t('auth.accessDenied'), ErrorCode.AccessDenied)}</Text>
        <Text as="p" variant="body">{t('auth.noPermission')}</Text>
      </Stack>
    );
  }
  return <>{children}</>;
};

export default ProtectedRoute;
