import React from 'react';
import './LoadingIndicator.css';

interface LoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  showText?: boolean;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ 
  size = 'medium', 
  text = 'Loading...', 
  showText = true 
}) => {
  return (
    <div className={`loading-container loading-${size}`}>
      <div className="loading-spinner">
        <div className="spinner-ring"></div>
      </div>
      {showText && <div className="loading-text">{text}</div>}
    </div>
  );
};

export default LoadingIndicator;
