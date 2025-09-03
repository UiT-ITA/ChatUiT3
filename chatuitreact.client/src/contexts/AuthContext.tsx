import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AccountInfo } from '@azure/msal-browser';
import authService from '../services/authService';
import signalrService from '../services/signalrService2';

// Define the shape of our auth context
interface AuthContextType {
  isAuthenticated: boolean;
  isInitializing: boolean;
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
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Handle redirect from Microsoft login
        await authService.initialize();
        
        // Check if we have a user account
        const currentAccount = authService.getAccount();
        
        if (currentAccount) {
          setAccount(currentAccount);
          setIsAuthenticated(true);

          signalrService.startConnection();

          // Extract roles from the account claims
          const userRoles: string[] = [];
          
          // In Azure AD, roles are present in the idTokenClaims
          if (currentAccount.idTokenClaims && 
              currentAccount.idTokenClaims.roles && 
              Array.isArray(currentAccount.idTokenClaims.roles)) {
            userRoles.push(...currentAccount.idTokenClaims.roles);
          }
          
          setRoles(userRoles);
          
          // Check if the user has admin role
          const hasAdminRole = userRoles.some(role => 
            role.toLowerCase() === 'admin' || 
            role.toLowerCase() === 'administrator'
          );
          setIsAdmin(hasAdminRole);
          
        }
      } catch (error) {
        console.error('Authentication initialization error:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAuth();
  }, []);

  // Auth context value
  const contextValue: AuthContextType = {
    isAuthenticated,
    isInitializing,
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
