import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AccountInfo } from '@azure/msal-browser';
import authService from '../services/authService';
import signalrService from '../services/signalrService';

// Define the shape of our auth context
interface AuthContextType {
  isAuthenticated: boolean;
  isInitializing: boolean;
  isSignalRConnected: boolean;
  isAppReady: boolean;
  account: AccountInfo | null;
  roles: string[];
  isAdmin: boolean;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

// Provider component that wraps the app
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isSignalRConnected, setIsSignalRConnected] = useState<boolean>(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    let authInitialized = false;
    let authPromise: Promise<void> | null = null;

    const ensureAuthInitialization = async () => {
      if (authInitialized) {
        return;
      }

      if (authPromise) {
        return authPromise;
      }

      authPromise = initializeAuth();
      await authPromise;
      authPromise = null;
    };

    const initializeAuth = async () => {
      try {
        await authService.initialize();
        const currentAccount = authService.getAccount();
        if (currentAccount) {
          setAccount(currentAccount);
          setIsAuthenticated(true);

          try {
            await signalrService.ensureConnection();
            setIsSignalRConnected(signalrService.isConnected());
          } catch (signalrError) {
            console.warn('Failed to start SignalR connection:', signalrError);
            setIsSignalRConnected(false);
          }

          const userRoles: string[] = [];
          
          if (currentAccount.idTokenClaims && 
              currentAccount.idTokenClaims.roles && 
              Array.isArray(currentAccount.idTokenClaims.roles)) {
            userRoles.push(...currentAccount.idTokenClaims.roles);
          }
          
          setRoles(userRoles);
          
          const hasAdminRole = userRoles.some(role => 
            role.toLowerCase() === 'admin' || 
            role.toLowerCase() === 'administrator'
          );
          setIsAdmin(hasAdminRole);
          setIsInitializing(false);
          authInitialized = true;
        } else {
          console.log("No account found, triggering auto-redirect to login...");
          await authService.getAccessToken();
          setIsInitializing(false);
          return;
        }
      } catch (error) {
        console.error('Authentication initialization error:', error);
        setAccount(null);
        setIsAuthenticated(false);
        setRoles([]);
        setIsAdmin(false);
        setIsInitializing(false);
        authInitialized = true;
      }
    };

    ensureAuthInitialization();
  }, []);

  // Calculate if app is ready (both auth and SignalR are ready)
  const isAppReady = isAuthenticated && isSignalRConnected;

  // Auth context value
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

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
