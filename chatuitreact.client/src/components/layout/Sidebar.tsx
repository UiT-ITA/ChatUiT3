import React, { useState } from 'react';
import './Sidebar.css';
import SidebarButton from './SidebarButton';
import { NavLink, useNavigate } from 'react-router-dom';
import { PiSidebarSimple } from "react-icons/pi";
import { RiSettings3Line, RiChatAiLine, RiAdminLine, RiUserLine, RiRobot2Line } from 'react-icons/ri';
import { GrHelpBook } from "react-icons/gr";
import { MdOutlineVpnKey } from "react-icons/md";

import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
 import { ChatList } from '../chat/ChatList';

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
            <PiSidebarSimple size={"24px"} />
          </button>

          <div className="sidebar-title">ChatUiT</div>

          <NavLink to="/c/new" className="icon-button" title={t('sidebar.newChat')}>
            <RiChatAiLine size={"24px"} />
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
            icon={<GrHelpBook size={24} />}
            text={t('sidebar.help')}
            onClick={() => handleNavigation('/help')}
            isNarrow={isNarrow}
          />

          <SidebarButton
            icon={<RiSettings3Line size={24} />}
            text={t('sidebar.settings')}
            onClick={() => setIsSettingsOpen(true)}
            isNarrow={isNarrow}
          />

          {isAdmin && (
            <SidebarButton
              icon={<RiAdminLine size={24} />}
              text={t('sidebar.admin')}
              onClick={() => handleNavigation('/admin')}
              isNarrow={isNarrow}
            />
          )}

          <SidebarButton
            icon={<RiRobot2Line size={24} />}
            text={t('sidebar.assistants')}
            onClick={() => handleNavigation('/assistants')}
            isNarrow={isNarrow}
          />

          <SidebarButton
            icon={<RiUserLine size={24} />}
            text={t('sidebar.profile')}
            onClick={() => handleNavigation('/profile')}
            isNarrow={isNarrow}
          />

          {isAuthenticated ? (
            <SidebarButton
              icon={<MdOutlineVpnKey size={24} />}
              text={t('sidebar.logout')}
              onClick={logout}
              isNarrow={isNarrow}
            />
          ) : (
            <SidebarButton
              icon={<MdOutlineVpnKey size={24} />}
              text={t('sidebar.login')}
              onClick={login}
              isNarrow={isNarrow}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
