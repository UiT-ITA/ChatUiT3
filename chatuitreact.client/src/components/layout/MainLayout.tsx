import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './MainLayout.css';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isInitializing, login, logout } = useAuth();

  return (
    <div className="layout-container">
      {/* App Bar - always visible */}
      <header className="app-bar">
        <h1>My Application</h1>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/weather">Weather</Link>
          <Link to="/test">Test</Link>
          {isAuthenticated ? (
            <button onClick={logout} className="logout-button">Sign Out</button>
          ) : (
            <button onClick={login} className="login-button">Sign In</button>
          )}
        </div>
      </header>
      
      <div className="content-wrapper">
        {/* Sidebar - always visible */}
        <aside className="sidebar">
          <nav>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/weather">Weather</Link></li>
              <li><Link to="/test">Test</Link></li>
              <li><Link to="/profile">Profile</Link></li>
            </ul>
          </nav>
        </aside>
        
        {/* Main Content Area - ALWAYS renders the Outlet */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;