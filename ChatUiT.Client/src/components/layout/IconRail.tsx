import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Icon';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { resolveMode } from '../../utils/themeUtils';
import './IconRail.css';

interface IconRailProps {
  isMobile?: boolean;
}

function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  const parts = name.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  // MSAL names may come as "Lastname, Firstname"
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] || '' : '';
  return (first + last).toUpperCase();
}

const IconRail = ({ isMobile }: IconRailProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isAuthenticated, account, login, logout } = useAuth();
  const { settings, updateSetting } = useSettings();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const section = location.pathname.startsWith('/assistants') ? 'assistants'
    : location.pathname.startsWith('/admin') ? 'admin'
    : location.pathname.startsWith('/settings') ? 'settings'
    : location.pathname.startsWith('/help') ? 'help'
    : location.pathname.startsWith('/status') ? 'status'
    : 'chats';

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  const toggleMode = () => {
    const darkNow = resolveMode(settings.mode) === 'dark';
    updateSetting('mode', darkNow ? 'light' : 'dark');
  };

  const darkNow = resolveMode(settings.mode) === 'dark';

  const go = (path: string) => {
    navigate(path);
    setUserMenuOpen(false);
  };

  return (
    <nav className={`icon-rail ${isMobile ? 'icon-rail-mobile' : ''}`}>
      {!isMobile && (
        <img
          className="rail-seal"
          src={darkNow ? '/chatuit-logo.svg' : '/chatuit-logo-darkblue.svg'}
          alt="UiT"
          title="ChatUiT"
        />
      )}

      <button className="rail-new-chat" onClick={() => go('/chat/new')} title={t('sidebar.newChat')}>
        <Icon name="chatNew" size={1.25} />
      </button>

      {!isMobile && <div className="rail-gap" />}

      <button
        className={`rail-button ${section === 'chats' ? 'active' : ''}`}
        onClick={() => go('/')}
        title={t('sidebar.chats')}
      >
        <Icon name="chat" size={1.25} />
      </button>
      <button
        className={`rail-button ${section === 'assistants' ? 'active' : ''}`}
        onClick={() => go('/assistants')}
        title={t('sidebar.assistants')}
      >
        <Icon name="assistants" size={1.25} />
      </button>
      {isAdmin && (
        <button
          className={`rail-button ${section === 'admin' ? 'active' : ''}`}
          onClick={() => go('/admin')}
          title={t('sidebar.admin')}
        >
          <Icon name="admin" size={1.25} />
        </button>
      )}

      <div className="rail-spacer" />

      {import.meta.env.DEV && (
        <button
          className={`rail-button ${section === 'status' ? 'active' : ''}`}
          onClick={() => go('/status')}
          title={t('sidebar.status')}
        >
          <Icon name="info" size={1.25} />
        </button>
      )}
      <button
        className={`rail-button ${section === 'help' ? 'active' : ''}`}
        onClick={() => go('/help')}
        title={t('sidebar.help')}
      >
        <Icon name="help" size={1.25} />
      </button>
      <button className="rail-button" onClick={toggleMode} title={t('sidebar.toggleMode')}>
        <Icon name={darkNow ? 'sun' : 'moon'} size={1.25} />
      </button>
      <button
        className={`rail-button ${section === 'settings' ? 'active' : ''}`}
        onClick={() => go('/settings')}
        title={t('sidebar.settings')}
      >
        <Icon name="settings" size={1.25} />
      </button>

      <div className="rail-user" ref={userMenuRef}>
        <button
          className="rail-avatar t-label"
          onClick={() => setUserMenuOpen((open) => !open)}
          title={account?.name || t('sidebar.profile')}
        >
          {getInitials(account?.name)}
        </button>
        {userMenuOpen && (
          <div className="rail-user-menu">
            <div className="rail-user-menu-header">
              <div className="rail-user-menu-name t-body-strong">{account?.name || t('sidebar.profile')}</div>
              {account?.username && <div className="rail-user-menu-email t-caption">{account.username}</div>}
            </div>
            <div className="rail-user-menu-items">
              <button className="t-body" onClick={() => go('/settings')}>{t('sidebar.settings')}</button>
              <button className="t-body" onClick={() => go('/help')}>{t('sidebar.help')}</button>
            </div>
            <div className="rail-user-menu-footer">
              {isAuthenticated ? (
                <button className="rail-user-menu-danger t-body" onClick={logout}>{t('sidebar.logout')}</button>
              ) : (
                <button className="t-body" onClick={login}>{t('sidebar.login')}</button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default IconRail;
