import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AccountInfo } from '@azure/msal-browser';
import authService from '../services/authService';

// Define the shape of our auth context
interface AuthContextType {
  isAuthenticated: boolean;
  isInitializing: boolean;
  account: AccountInfo | null;
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

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Handle redirect from Microsoft login
          const result = await authService.initialize();
        
        // Check if we have a user account
        const currentAccount = authService.getAccount();
        
        if (currentAccount) {
          setAccount(currentAccount);
          setIsAuthenticated(true);
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

