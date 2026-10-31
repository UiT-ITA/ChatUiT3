import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { IconName } from '../common/Icon';
import IconButton from '../common/IconButton';
import Popover from '../common/Popover';
import { Menu, MenuItem, MenuDivider } from '../common/Menu';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { resolveMode } from '../../utils/themeUtils';
import useMediaQuery from '../../hooks/useMediaQuery';
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
  // A top bar too narrow for every icon keeps only the main sections and moves the rest into the menu
  const compact = useMediaQuery('(max-width: 27.5rem)') && !!isMobile;

  const section = location.pathname.startsWith('/assistants') ? 'assistants'
    : location.pathname.startsWith('/generate') ? 'generate'
    : location.pathname.startsWith('/admin') ? 'admin'
    : location.pathname.startsWith('/settings') ? 'settings'
    : location.pathname.startsWith('/help') ? 'help'
    : location.pathname.startsWith('/status') ? 'status'
    : 'chats';

  const toggleMode = () => {
    const darkNow = resolveMode(settings.mode) === 'dark';
    updateSetting('mode', darkNow ? 'light' : 'dark');
  };

  const darkNow = resolveMode(settings.mode) === 'dark';

  const go = (path: string) => {
    navigate(path);
    setUserMenuOpen(false);
  };

  // Rail buttons after the main sections; a compact top bar lists them in the menu instead
  const secondaryItems: { key: string; icon: IconName; title: string; menuLabel: string; active: boolean; onClick: () => void }[] = [
    ...(import.meta.env.DEV
      ? [{ key: 'status', icon: 'info' as IconName, title: t('sidebar.status'), menuLabel: t('sidebar.status'), active: section === 'status', onClick: () => go('/status') }]
      : []),
    { key: 'help', icon: 'help', title: t('sidebar.help'), menuLabel: t('sidebar.help'), active: section === 'help', onClick: () => go('/help') },
    { key: 'mode', icon: darkNow ? 'sun' : 'moon', title: t('sidebar.toggleMode'), menuLabel: t(darkNow ? 'sidebar.lightMode' : 'sidebar.darkMode'), active: false, onClick: toggleMode },
    { key: 'settings', icon: 'settings', title: t('sidebar.settings'), menuLabel: t('sidebar.settings'), active: section === 'settings', onClick: () => go('/settings') },
  ];

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

      {!isMobile && <div className="rail-gap" />}

      <IconButton iconSize="xl" icon="chatNew" label={t('sidebar.chats')} active={section === 'chats'} onClick={() => go('/')} />
      <IconButton iconSize="xl" icon="assistants" label={t('sidebar.assistants')} active={section === 'assistants'} onClick={() => go('/assistants')} />
      <IconButton iconSize="xl" icon="image" label={t('sidebar.generate')} active={section === 'generate'} onClick={() => go('/generate')} />
      {isAdmin && (
        <IconButton iconSize="xl" icon="admin" label={t('sidebar.admin')} active={section === 'admin'} onClick={() => go('/admin')} />
      )}

      <div className="rail-spacer" />

      {!compact && secondaryItems.map(item => (
        <IconButton iconSize="xl" key={item.key} icon={item.icon} label={item.title} active={item.active} onClick={item.onClick} />
      ))}

      <Popover
        open={userMenuOpen}
        onOpenChange={setUserMenuOpen}
        placement={isMobile ? 'bottom-end' : 'right-end'}
        panelWidth="medium"
        trigger={compact ? (
          <IconButton iconSize="xl" icon="menu" label={t('navigation.menu')} active={userMenuOpen} />
        ) : (
          <IconButton
            icon={<span className="rail-avatar t-label">{getInitials(account?.name)}</span>}
            label={account?.name || t('sidebar.profile')}
          />
        )}
      >
        <div className="rail-user-menu-header">
          <div className="rail-user-menu-name t-body-strong">{account?.name || t('sidebar.profile')}</div>
          {account?.username && <div className="rail-user-menu-email t-caption">{account.username}</div>}
        </div>
        <Menu>
          {compact ? (
            secondaryItems.map(item => (
              <MenuItem key={item.key} icon={item.icon} onClick={item.onClick}>
                {item.menuLabel}
              </MenuItem>
            ))
          ) : (
            <>
              <MenuItem onClick={() => go('/settings')}>{t('sidebar.settings')}</MenuItem>
              <MenuItem onClick={() => go('/help')}>{t('sidebar.help')}</MenuItem>
            </>
          )}
          <MenuDivider />
          {isAuthenticated ? (
            <MenuItem danger onClick={logout}>{t('sidebar.logout')}</MenuItem>
          ) : (
            <MenuItem onClick={login}>{t('sidebar.login')}</MenuItem>
          )}
        </Menu>
      </Popover>
    </nav>
  );
};

export default IconRail;
