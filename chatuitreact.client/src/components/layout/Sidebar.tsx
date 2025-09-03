import { useState } from 'react';
import './Sidebar.css';
import SidebarButton from './SidebarButton';
import { NavLink, useNavigate } from 'react-router-dom';
import { Icon } from '../common/Icon';

import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { ChatList } from '../chat/ChatList';
import { useState as useThemeState, useEffect } from 'react';
import { 
  ThemeName, 
  SizeName, 
  THEME_OPTIONS, 
  SIZE_OPTIONS, 
  setTheme, 
  setSize, 
  getCurrentTheme, 
  getCurrentSize 
} from '../../utils/themeUtils';

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
  
  // Theme and size state
  const [currentTheme, setCurrentTheme] = useThemeState<ThemeName>(getCurrentTheme);
  const [currentSize, setCurrentSize] = useThemeState<SizeName>(getCurrentSize);

  useEffect(() => {
    setCurrentTheme(getCurrentTheme());
    setCurrentSize(getCurrentSize());
  }, []);

  const handleThemeChange = (newTheme: ThemeName) => {
    setTheme(newTheme);
    setCurrentTheme(newTheme);
  };

  const handleSizeChange = (newSize: SizeName) => {
    setSize(newSize);
    setCurrentSize(newSize);
  };

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
        
        {/* Temporary theme and size selectors for testing */}
        {!isNarrow && (
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-primary)' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '0.75rem', 
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem'
              }}>
                Theme
              </label>
              <select
                value={currentTheme}
                onChange={(e) => handleThemeChange(e.target.value as ThemeName)}
                style={{
                  width: '100%',
                  padding: '0.25rem',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem'
                }}
              >
                {THEME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                fontSize: '0.75rem', 
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem'
              }}>
                Size
              </label>
              <select
                value={currentSize}
                onChange={(e) => handleSizeChange(e.target.value as SizeName)}
                style={{
                  width: '100%',
                  padding: '0.25rem',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem'
                }}
              >
                {SIZE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        
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
      {isSettingsOpen && (
        <div className="settings-modal">
          <h2>{t('sidebar.settings')}</h2>
          {/* Settings content goes here */}
        </div>
      )}
    </>
  );
};

export default Sidebar;
