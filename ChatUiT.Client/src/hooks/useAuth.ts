import { createContext, useContext } from 'react';
import type { AccountInfo } from '@azure/msal-browser';

export interface AuthContextType {
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

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
