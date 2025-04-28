import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './WelcomePage.css';

const WelcomePage: React.FC = () => {
  const { login } = useAuth();

  return (
    <div className="welcome-container">
      <h1>Welcome to the Application</h1>
      <p>Please sign in to continue</p>
      <button 
        onClick={login}
        className="login-button">
        Sign in with Microsoft
      </button>
    </div>
  );
};

export default WelcomePage;

