import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// import { useTranslation } from 'react-i18next';
import { useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import MainLayout from './components/layout/MainLayout';
// import ProtectedRoute from './components/common/ProtectedRoute';
import LoadingIndicator from './components/common/LoadingIndicator';
import './App.css';
import './styles/theme.css';
import ChatPage from './components/chat/ChatPage';
import AssistantsPage from './components/assistants/AssistantsPage';


const App: React.FC = () => {
  const { isAppReady } = useAuth();

  if (!isAppReady) {
    return <LoadingIndicator />;
  }

  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<ChatPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/chat/new" element={<ChatPage />} />
            <Route path="/chat/:chatId" element={<ChatPage />} />
            <Route path="/assistants" element={<AssistantsPage />} />
            {/* <Route 
              path="/admin" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Home />
                </ProtectedRoute>
              } 
            /> */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SettingsProvider>
  );
};

export default App;
