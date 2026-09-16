import React from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import LoadingIndicator from './LoadingIndicator';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { t } = useTranslation();
  const { isAuthenticated, roles, isInitializing } = useAuth();
  
  if (isInitializing) {
    return <LoadingIndicator />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  if (requiredRole && !roles.some(role => 
    role.toLowerCase() === requiredRole.toLowerCase() || 
    role.toLowerCase() === 'admin' || 
    role.toLowerCase() === 'administrator'
  )) {
    return (
      <div className="unauthorized-content">
        <h2>{t('auth.accessDenied')}</h2>
        <p>{t('auth.noPermission')}</p>
      </div>
    );
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;
