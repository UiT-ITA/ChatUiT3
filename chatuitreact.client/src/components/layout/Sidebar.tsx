import './Sidebar.css';
import SidebarButton from './SidebarButton';
import { NavLink, useNavigate } from 'react-router-dom';
import { PiSidebarSimple } from "react-icons/pi";
import { RiSettings3Line, RiChatAiLine, RiChatSettingsLine, RiAdminLine, RiUserLine } from 'react-icons/ri';
import { GrHelpBook } from "react-icons/gr";
import { MdOutlineVpnKey } from "react-icons/md";

import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../common/LanguageSwitcher';
// import { ChatList } from '../chat/ChatList';

interface SidebarProps {
  onToggleSidebar: () => void;
  isNarrow: boolean;
  content: React.ReactNode;
}

const Sidebar = ({ onToggleSidebar, isNarrow, content}: SidebarProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated, login, logout } = useAuth();





  return (
    <div className={`sidebar ${isNarrow ? 'narrow' : 'wide'}`}>
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
          { content }
        </div>
      </div>

      <div className="sidebar-divider" />
      <div className="sidebar-bottom">
        <LanguageSwitcher />
        <SidebarButton
          icon={<GrHelpBook size={24} />}
          text={t('sidebar.help')}
          onClick={() => navigate('/help')}
          isNarrow={isNarrow}
        />

        <SidebarButton
          icon={<RiSettings3Line size={24} />}
          text={t('sidebar.settings')}
          onClick={() => console.log('Settings clicked')}
          isNarrow={isNarrow}
        />

        {isAdmin && (
          <SidebarButton
            icon={<RiAdminLine size={24} />}
            text={t('sidebar.admin')}
            onClick={() => navigate('/admin')}
            isNarrow={isNarrow}
          />
        )}

        <SidebarButton
          icon={<RiUserLine size={24} />}
          text={t('sidebar.profile')}
          onClick={() => navigate('/profile')}
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
  );
};

export default Sidebar;
