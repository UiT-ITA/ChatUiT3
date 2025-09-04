import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoadingIndicator from './components/common/LoadingIndicator';
import './App.css';
import './styles/theme.css';
import ChatPage from './components/chat/ChatPage';
import { useEffect } from 'react';
import { initializeTheme } from './utils/themeUtils';
import AssistantsPage from './components/assistants/AssistantsPage';

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



const App: React.FC = () => {
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/new" element={<ChatPage />} />
          <Route path="/chat/:chatId" element={<ChatPage />} />
          <Route path="/assistants" element={<AssistantsPage />} />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requiredRole="admin">
                <Home />
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
