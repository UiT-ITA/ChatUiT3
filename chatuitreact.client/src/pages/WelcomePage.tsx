import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const WelcomePage: React.FC = () => {
  const { isAuthenticated, isInitializing, login } = useAuth();
  const navigate = useNavigate();
  
  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isInitializing, navigate]);

  const handleLogin = async () => {
    try {
      await login();
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="welcome-container">
      <h1>Welcome to the Application</h1>
      <p>Please sign in to continue</p>
      <button 
        onClick={handleLogin}
        className="login-button">
        Sign in with Microsoft
      </button>
    </div>
  );
};

export default WelcomePage;

