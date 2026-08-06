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
  initError: string | null;
  account: AccountInfo | null;
  roles: string[];
  isAdmin: boolean;
  login: () => Promise<void>;
  logout: () => void;
  retryInit: () => void;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isSignalRConnected, setIsSignalRConnected] = useState<boolean>(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState<number>(0);
  const [roles, setRoles] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Prefer the active account, but resolve it to the stable object from the
  // `accounts` array: getActiveAccount() returns a fresh object on every
  // call, and an unstable identity here re-triggers the init effect forever.
  const activeHomeAccountId = instance.getActiveAccount()?.homeAccountId;
  const account = accounts.find(a => a.homeAccountId === activeHomeAccountId) ?? accounts[0] ?? null;

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
        setInitError(null);

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
        setInitError(signalrError instanceof Error ? signalrError.message : String(signalrError));
      } finally {
        setIsInitializing(false);
      }
    };

    initializeApp();
    // Depend on the account's id, not the object, so an unstable object
    // identity can never re-trigger this effect in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, account?.homeAccountId, initAttempt]);

  const retryInit = () => {
    setInitError(null);
    setIsInitializing(true);
    setInitAttempt(attempt => attempt + 1);
  };

  const isAppReady = isAuthenticated && isSignalRConnected && !isInitializing;

  const contextValue: AuthContextType = {
    isAuthenticated,
    isInitializing,
    isSignalRConnected,
    isAppReady,
    initError,
    account,
    roles,
    isAdmin,
    login: () => authService.login(),
    logout: () => authService.logout(),
    retryInit,
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
