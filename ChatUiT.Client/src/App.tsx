import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BrowserAuthError } from '@azure/msal-browser';
import { effect } from '@preact/signals-react';
import { useAuth } from './hooks/useAuth';
import MainLayout from './components/layout/MainLayout';
import LoadingIndicator from './components/common/LoadingIndicator';
import InitErrorScreen from './components/common/InitErrorScreen';
import './App.css';
import './styles/theme.css';
import './styles/typography.css';
import ProtectedRoute from './components/common/ProtectedRoute';
import { getChats } from './services/chatService';
import { whenIdle } from './utils/whenIdle';

// Pages are separate chunks so the first render only needs the chat surface.
const loadAssistantsPage = () => import('./components/assistants/AssistantsPage');
const loadSettingsPage = () => import('./components/settings/SettingsPage');
const loadHelpPage = () => import('./components/help/HelpPage');
const loadAdminPage = () => import('./components/admin/AdminPage');
const loadGeneratePage = () => import('./components/generate/GeneratePage');

const AssistantsPage = lazy(loadAssistantsPage);
const SettingsPage = lazy(loadSettingsPage);
const HelpPage = lazy(loadHelpPage);
const AdminPage = lazy(loadAdminPage);
const GeneratePage = lazy(loadGeneratePage);
const StatusPage = lazy(() => import('./components/status/StatusPage'));

// Suspends per route, below MainLayout, so the always-mounted chat surface
// is never replaced by the fallback while a page chunk loads.
const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingIndicator />}>{children}</Suspense>
);


const App: React.FC = () => {
  const { isAuthenticated, isInitializing, isAppReady, isAdmin, initError, login, logout, retryInit } = useAuth();
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

  // Once the chat list has loaded, fetch the other pages in the background.
  // The admin page is only fetched for admins.
  useEffect(() => {
    if (!isAppReady) return;
    let prefetched = false;
    return effect(() => {
      if (prefetched || getChats().value === undefined) return;
      prefetched = true;
      whenIdle().then(() => {
        loadAssistantsPage();
        loadSettingsPage();
        loadHelpPage();
        loadGeneratePage();
        if (isAdmin) loadAdminPage();
      });
    });
  }, [isAppReady, isAdmin]);

  if (initError) {
    return <InitErrorScreen message={initError} onRetry={retryInit} onSignOut={logout} />;
  }

  if (!isAppReady) {
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
          <Route path="/assistants" element={<Page><AssistantsPage /></Page>} />
          <Route path="/assistants/:assistantId" element={<Page><AssistantsPage /></Page>} />
          <Route path="/generate" element={<Page><GeneratePage /></Page>} />
          <Route path="/generate/:generationId" element={<Page><GeneratePage /></Page>} />
          <Route path="/settings" element={<Page><SettingsPage /></Page>} />
          <Route path="/settings/:tab" element={<Page><SettingsPage /></Page>} />
          <Route path="/help" element={<Page><HelpPage /></Page>} />
          <Route path="/help/:section" element={<Page><HelpPage /></Page>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <Page><AdminPage /></Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/:tab"
            element={
              <ProtectedRoute requiredRole="admin">
                <Page><AdminPage /></Page>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/:tab/:id"
            element={
              <ProtectedRoute requiredRole="admin">
                <Page><AdminPage /></Page>
              </ProtectedRoute>
            }
          />
          {import.meta.env.DEV && <Route path="/status" element={<Page><StatusPage /></Page>} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
