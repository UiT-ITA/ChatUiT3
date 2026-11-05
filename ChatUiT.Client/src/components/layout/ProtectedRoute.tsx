import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import LoadingIndicator from '../common/LoadingIndicator';
import Stack from '../common/Stack';
import Text from '../common/Text';

/** Shows its children to a signed-in user with the required role. Admins have every role. */
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string }> = ({ children, requiredRole }) => {
  const { t } = useTranslation();
  const { isAuthenticated, roles, isInitializing } = useAuth();
  if (isInitializing) return <LoadingIndicator />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (requiredRole && !roles.some(role => [requiredRole.toLowerCase(), 'admin', 'administrator'].includes(role.toLowerCase()))) {
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
