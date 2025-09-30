import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AccountInfo } from '@azure/msal-browser';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import authService from '../services/authService';
import signalrService from '../services/signalrService';

interface AuthContextType {
  isAuthenticated: boolean;
  isInitializing: boolean;
  isSignalRConnected: boolean;
  isAppReady: boolean;
  account: AccountInfo | null;
  roles: string[];
  isAdmin: boolean;
  login: () => Promise<void>;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isSignalRConnected, setIsSignalRConnected] = useState<boolean>(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  const account = accounts[0] || null;

  useEffect(() => {
    const initializeApp = async () => {
      if (!isAuthenticated) {
        setIsInitializing(false);
        return;
      }

      if (!account) {
        setIsInitializing(false);
        return;
      }

      try {
        await signalrService.ensureConnection();
        setIsSignalRConnected(signalrService.isConnected());

        const userRoles: string[] = [];
        
        if (account.idTokenClaims && 
            account.idTokenClaims.roles && 
            Array.isArray(account.idTokenClaims.roles)) {
          userRoles.push(...account.idTokenClaims.roles);
        }
        
        setRoles(userRoles);
        
        const hasAdminRole = userRoles.some(role => 
          role.toLowerCase() === 'admin' || 
          role.toLowerCase() === 'administrator'
        );
        setIsAdmin(hasAdminRole);
      } catch (signalrError) {
        console.warn('Failed to start SignalR connection:', signalrError);
        setIsSignalRConnected(false);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, [isAuthenticated, account]);

  const isAppReady = isAuthenticated && isSignalRConnected && !isInitializing;

  const contextValue: AuthContextType = {
    isAuthenticated,
    isInitializing,
    isSignalRConnected,
    isAppReady,
    account,
    roles,
    isAdmin,
    login: () => authService.login(),
    logout: () => authService.logout(),
    getAccessToken: () => authService.getAccessToken(),
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
