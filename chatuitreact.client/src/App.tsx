import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BrowserAuthError } from '@azure/msal-browser';
import { useAuth } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import LoadingIndicator from './components/common/LoadingIndicator';
import './App.css';
import './styles/theme.css';
// import ChatPage from './components/chat/ChatPage';
// import NewChatPage from './components/chat/NewChatPage';
import SimpleChatPage from './components/chat/SimpleChatPage';
import AssistantsPage from './components/assistants/AssistantsPage';
import AdminPage from './components/admin/AdminPage';
import ProtectedRoute from './components/common/ProtectedRoute';

const App: React.FC = () => {
  const { isAuthenticated, isInitializing, isAppReady, login } = useAuth();
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
    return <LoadingIndicator />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<SimpleChatPage />} />
          <Route path="/chat" element={<SimpleChatPage />} />
          <Route path="/chat/new" element={<SimpleChatPage />} />
          <Route path="/chat/:chatId" element={<SimpleChatPage />} />
          <Route path="/assistants" element={<AssistantsPage />} />
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
  );
};

export default App;
