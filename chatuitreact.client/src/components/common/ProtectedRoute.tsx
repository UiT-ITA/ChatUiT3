import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingIndicator from './LoadingIndicator';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
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
        <h2>Access Denied</h2>
        <p>You do not have permission to access this page.</p>
      </div>
    );
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;
