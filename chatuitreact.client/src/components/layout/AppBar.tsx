import React from 'react';
import { RiMenuLine, RiChatAiLine } from 'react-icons/ri';
import './AppBar.css';

interface AppBarProps {
  onMenuClick: () => void;
  onNewChatClick: () => void;
}

const AppBar: React.FC<AppBarProps> = ({ onMenuClick, onNewChatClick }) => {
  return (
    <div className="app-bar">
      <button className="icon-button" onClick={onMenuClick} title="Menu">
        <RiMenuLine size="24px" />
      </button>
      
      <div className="app-bar-title">ChatUiT</div>
      
      <button className="icon-button" onClick={onNewChatClick} title="New Chat">
        <RiChatAiLine size="24px" />
      </button>
    </div>
  );
};

export default AppBar;
