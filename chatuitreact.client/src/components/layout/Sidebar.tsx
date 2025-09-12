import { useState } from 'react';
import './Sidebar.css';
import SidebarButton from './SidebarButton';
import { NavLink, useNavigate } from 'react-router-dom';
import { Icon } from '../common/Icon';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { ChatList } from '../chat/ChatList';
import SettingsModal from '../settings/SettingsModal';

interface SidebarProps {
  onToggleSidebar: () => void;
  isNarrow: boolean;
  isMobile?: boolean;
  isMobileMenuOpen?: boolean;
  onMobileClose?: () => void;
}

const Sidebar = ({ onToggleSidebar, isNarrow, isMobile, isMobileMenuOpen, onMobileClose}: SidebarProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, login, logout } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const getSidebarClass = () => {
    if (isMobile) {
      return `sidebar mobile-sidebar ${isMobileMenuOpen ? 'mobile-open' : 'mobile-closed'}`;
    }
    return `sidebar ${isNarrow ? 'narrow' : 'wide'}`;
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  return (
    <>
      <div className={getSidebarClass()}>
        <div className="sidebar-top">
          <button className="icon-button sidebar-toggle" onClick={onToggleSidebar} title={isNarrow ? t('sidebar.expand') : t('sidebar.collapse')}>
            <Icon name="sidebarToggle" size={1.5} />
          </button>

          <div className="sidebar-title">ChatUiT</div>

          <NavLink to="/chat/new" className="icon-button" title={t('sidebar.newChat')}>
            <Icon name="chat" size={1.5} />
          </NavLink>
        </div>

        <div className="sidebar-divider" />

        <div className="sidebar-content">
          <div className="sidebar-content-inner">
            <ChatList />
          </div>
        </div>

        <div className="sidebar-divider" />
        
        <div className="sidebar-bottom">
          <SidebarButton
            icon={<Icon name="help" size={1.5} />}
            text={t('sidebar.help')}
            onClick={() => handleNavigation('/help')}
            isNarrow={isNarrow}
          />

          <SidebarButton
            icon={<Icon name="settings" size={1.5} />}
            text={t('sidebar.settings')}
            onClick={() => setIsSettingsOpen(true)}
            isNarrow={isNarrow}
          />

          {isAdmin && (
            <SidebarButton
              icon={<Icon name="admin" size={1.5} />}
              text={t('sidebar.admin')}
              onClick={() => handleNavigation('/admin')}
              isNarrow={isNarrow}
            />
          )}

          <SidebarButton
            icon={<Icon name="assistants" size={1.5} />}
            text={t('sidebar.assistants')}
            onClick={() => handleNavigation('/assistants')}
            isNarrow={isNarrow}
          />

          <SidebarButton
            icon={<Icon name="user" size={1.5} />}
            text={t('sidebar.profile')}
            onClick={() => handleNavigation('/profile')}
            isNarrow={isNarrow}
          />

          {isAuthenticated ? (
            <SidebarButton
              icon={<Icon name="key" size={1.5} />}
              text={t('sidebar.logout')}
              onClick={logout}
              isNarrow={isNarrow}
            />
          ) : (
            <SidebarButton
              icon={<Icon name="key" size={1.5} />}
              text={t('sidebar.login')}
              onClick={login}
              isNarrow={isNarrow}
            />
          )}
        </div>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
};

export default Sidebar;
