import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AppBar: React.FC = () => {
  const { logout } = useAuth();
  
  return (
    <header className="app-bar">
      <div className="app-title">My Application</div>
      <nav className="app-nav">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/weather">Weather</Link>
        <button onClick={logout} className="logout-button">Logout</button>
      </nav>
    </header>
  );
};

export default AppBar;