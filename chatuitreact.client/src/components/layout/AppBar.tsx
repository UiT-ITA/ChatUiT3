import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AppBar: React.FC = () => {
    const { isAuthenticated, login, logout } = useAuth();
    
    return (
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
    );
};

export default AppBar;