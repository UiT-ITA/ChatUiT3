import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { QueryProvider } from './contexts/QueryProvider';
import { ChatDataProvider } from './contexts/ChatDataProvider';
import { SignalRProvider } from './contexts/SignalRContext';
import MainLayout from './components/layout/MainLayout';
import Test from './pages/TestPage';
import Profile from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import HelpPage from './pages/HelpPage';
import ChatPage from './pages/ChatPage';
import AssistantsPage from './pages/AssistantsPage';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoadingIndicator from './components/common/LoadingIndicator';
import { apiService } from './services/apiService';
import './App.css';
import './styles/themes.css';

const Home = () => {
  const { isAuthenticated, isInitializing, account } = useAuth();
  
  if (isInitializing) {
    return <LoadingIndicator />;
  }
  
  if (isAuthenticated) {
    return (
      <div className="authenticated-content">
        <h2>Welcome, {account?.name || 'User'}</h2>
        <p>You are signed in. Select an option from the sidebar to continue.</p>
      </div>
    );
  } else {
    return (
      <div className="unauthenticated-content">
        <h2>Welcome</h2>
        <p>Please use the Sign In button in the top bar to access all features.</p>
      </div>
    );
  }
};

// Component to initialize API service with auth
const AuthInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken } = useAuth();

  useEffect(() => {
    // Set up API service with authentication
    apiService.setTokenProvider(getAccessToken);
  }, [getAccessToken]);

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthInitializer>
          <QueryProvider>
            <ChatDataProvider>
              <SignalRProvider>
                <BrowserRouter>
                  <Routes>
                    <Route element={<MainLayout />}>
                      <Route path="/" element={<Home />} />
                      <Route path="/test" element={<Test />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/help" element={<HelpPage />} />
                      <Route path="/assistants" element={<AssistantsPage />} />
                      <Route path="/c/new" element={<ChatPage />} /> 
                      <Route path="/c/:chatId" element={<ChatPage />} />
                      <Route 
                        path="/admin" 
                        element={
                          <ProtectedRoute requiredRole="admin">
                            <AdminPage />
                          </ProtectedRoute>
                        } 
                      />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
              </SignalRProvider>
            </ChatDataProvider>
          </QueryProvider>
        </AuthInitializer>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
