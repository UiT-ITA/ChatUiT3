import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BrowserAuthError } from '@azure/msal-browser';
import { useAuth } from './hooks/useAuth';
import MainLayout from './components/layout/MainLayout';
import LoadingIndicator from './components/common/LoadingIndicator';
import InitErrorScreen from './components/common/InitErrorScreen';
import './App.css';
import './styles/theme.css';
import './styles/typography.css';
import AssistantsPage from './components/assistants/AssistantsPage';
import AdminPage from './components/admin/AdminPage';
import SettingsPage from './components/settings/SettingsPage';
import HelpPage from './components/help/HelpPage';
import ProtectedRoute from './components/common/ProtectedRoute';

const App: React.FC = () => {
  const { isAuthenticated, isInitializing, isAppReady, initError, login, logout, retryInit } = useAuth();
  const loginInitiatedRef = useRef(false);

  useEffect(() => {
    if (!isInitializing && !isAuthenticated && !loginInitiatedRef.current) {
      loginInitiatedRef.current = true;
      login().catch(error => {
        if (!(error instanceof BrowserAuthError && 
              error.errorCode === 'interaction_in_progress')) {
          console.error('Login error:', error);
        }
      });
    }
  }, [isInitializing, isAuthenticated, login]);

  if (!isAppReady) {
    if (initError) {
      return <InitErrorScreen message={initError} onRetry={retryInit} onSignOut={logout} />;
    }
    return <LoadingIndicator />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Chat routes render nothing here on purpose: the chat surface is
              mounted permanently by MainLayout so opened chats are never
              unmounted. These routes only drive which chat it displays. */}
          <Route path="/" element={null} />
          <Route path="/chat" element={null} />
          <Route path="/chat/new" element={null} />
          <Route path="/chat/:chatId" element={null} />
          <Route path="/assistants" element={<AssistantsPage />} />
          <Route path="/assistants/:assistantId" element={<AssistantsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:tab" element={<SettingsPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/help/:section" element={<HelpPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/:tab"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/:tab/:id"
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
  );
};

export default App;
