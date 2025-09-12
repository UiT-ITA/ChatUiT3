import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Icon';
import './AppBar.css';

interface AppBarProps {
  onMenuClick: () => void;
  onNewChatClick: () => void;
}

const AppBar: React.FC<AppBarProps> = ({ onMenuClick, onNewChatClick }) => {
  const { t } = useTranslation();
  
  return (
    <div className="app-bar">
      <button className="icon-button" onClick={onMenuClick} title={t('navigation.menu')}>
        <Icon name="menu" size={1.5} />
      </button>
      
      <div className="app-bar-title">ChatUiT</div>
      
      <button className="icon-button" onClick={onNewChatClick} title={t('navigation.newChat')}>
        <Icon name="chat" size={1.5} />
      </button>
    </div>
  );
};

export default AppBar;
