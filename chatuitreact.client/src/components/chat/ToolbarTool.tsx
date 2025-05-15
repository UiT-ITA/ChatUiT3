import React from 'react';
import './ToolbarTool.css';

interface ToolbarToolProps {
  icon: React.ReactNode;
  label: string;
  isToggleable?: boolean;
  isActive?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
  hideLabel?: boolean;
}

const ToolbarTool = ({ 
  icon, 
  label, 
  isToggleable = false, 
  isActive = false, 
  onClick,
  children,
  hideLabel = false
}: ToolbarToolProps) => {
  return (
    <button 
      className={`toolbar-tool ${isToggleable ? 'toggleable' : ''} ${isActive ? 'active' : ''}`}
      onClick={onClick}
      title={label}
    >
      <span className="tool-icon">{icon}</span>
      {!hideLabel && <span className="tool-label">{label}</span>}
      {children}
    </button>
  );
};

export default ToolbarTool;
