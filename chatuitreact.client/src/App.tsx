import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Weather from './pages/WeatherPage';
import Test from './pages/TestPage';
import Profile from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import Help from './pages/HelpPage';
import ChatPage from './pages/ChatPage';
import './App.css';
import { ChatServiceProvider } from './contexts/ChatServiceContext';

// Protected route component that requires admin role
const AdminRoute = () => {
  const { isAuthenticated, isAdmin, isInitializing } = useAuth();
  
  if (isInitializing) {
    return <div className="loading-container">Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  if (!isAdmin) {
    return (
      <div className="unauthorized-content">
        <h2>Access Denied</h2>
        <p>You do not have permission to access this page.</p>
      </div>
    );
  }
  
  return <Outlet />;
};

// Home content component
const Home = () => {
  const { isAuthenticated, isInitializing, account } = useAuth();
  
  if (isInitializing) {
    return <div className="loading-container">Loading...</div>;
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
  return (
    <AuthProvider>
      <ChatServiceProvider>
        <BrowserRouter>
          <Routes>
            {/* All routes use MainLayout as their parent */}
            <Route element={<MainLayout />}>
            {/* Home route */}
            <Route path="/" element={<Home />} />
            
            {/* Feature routes */}
            <Route path="/weather" element={<Weather />} />
            <Route path="/test" element={<Test />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/help" element={<Help />} />

            <Route path="/c/new" element={<ChatPage />} /> 
            <Route path="/c/:chatId" element={<ChatPage />} />
            
            {/* Admin routes - protected by admin role */}
            <Route path="/admin" element={<AdminRoute />}>
                <Route index element={<AdminPage />} />
            </Route>
            
            {/* Catch all other routes and redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ChatServiceProvider>
    </AuthProvider>
  );
};

export default App;
