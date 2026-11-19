import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { Icon, type IconName } from '../common/Icon';
import { Rail, RailAvatar, RailButton, RailGap, RailIconButton, RailMenuHeader, RailSeal, RailSpacer } from './AppShell';
import { Menu, MenuContent, MenuItem, MenuItemIcon, MenuSeparator, MenuTrigger } from '@ui-sdk/react/menu';
import { floatingPanelClass } from '../common/floatingPanel';
import { spacePx } from '../common/layout';
import { MainHeaderContent } from './MainHeader';
import { useHeaderBack } from './useHeaderBack';
import { useAuth } from '../../hooks/useAuth';
import { useDarkMode } from '../../services/appearance';
import { NEW_CHAT_PATH, parseRoute, sectionPath } from '../../utils/routes';
import { downloadTrainingCertificate, trainingOpenSignal, trainingStatusSignal } from '../../services/trainingService';

// The first letters of the first and the last word, split on spaces and commas as in "Lastname, Firstname"
function getInitials(name: string | undefined | null): string {
  const parts = (name ?? '').split(/[\s,]+/).filter(Boolean);
  return parts.length === 0 ? '?' : (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const IconRail = ({ isMobile }: { isMobile?: boolean }) => {
  useSignals();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { section, newChat } = parseRoute(useLocation().pathname);
  const { isAdmin, isAuthenticated, account, login, logout, canSignOut } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const railRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  // A mobile view with a back control: the top bar shows the main column header's content
  const back = useHeaderBack(isMobile);
  const header = Boolean(isMobile && back);

  // A top bar too narrow for every icon keeps only the main sections and moves the rest into the menu.
  // When its content changes, the bar returns to full form and measures its full width again.
  const contentKey = `${isMobile}|${isAdmin}|${header}`;
  const [measuredKey, setMeasuredKey] = useState(contentKey);
  if (measuredKey !== contentKey) {
    setMeasuredKey(contentKey);
    setCompact(false);
  }

  useLayoutEffect(() => {
    const element = railRef.current;
    if (!element || !isMobile || header) return;
    const fullWidth = element.scrollWidth;
    const observer = new ResizeObserver(() => setCompact(element.clientWidth < fullWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [isMobile, header, measuredKey]);

  // Active in the chats section, except on a new chat on mobile, where the new chat button is active
  const chatsActive = section === 'chats' && !(isMobile && newChat);

  const darkMode = useDarkMode();

  const go = (path: string) => navigate(path);

  const training = trainingStatusSignal.value;
  const trainingHasNewVersion = training?.completedVersion != null && training.completedVersion < training.currentVersion;

  const openTraining = () => {
    trainingOpenSignal.value = true;
  };

  const downloadCertificate = () => {
    downloadTrainingCertificate(i18n.language).catch(() => undefined);
  };

  // Rail buttons after the main sections; a compact top bar lists them in the menu instead
  const secondaryItems: { key: string; icon: IconName; title: string; menuLabel: string; active: boolean; onClick: () => void }[] = [
    ...(import.meta.env.DEV
      ? [{ key: 'status', icon: 'pulse' as IconName, title: t('sidebar.status'), menuLabel: t('sidebar.status'), active: section === 'status', onClick: () => go(sectionPath('status')) }]
      : []),
    { key: 'help', icon: 'help', title: t('sidebar.help'), menuLabel: t('sidebar.help'), active: section === 'help', onClick: () => go(sectionPath('help')) },
    { key: 'mode', icon: darkMode.dark ? 'sun' : 'moon', title: t('sidebar.toggleMode'), menuLabel: t(darkMode.dark ? 'sidebar.lightMode' : 'sidebar.darkMode'), active: false, onClick: darkMode.toggle },
    { key: 'settings', icon: 'settings', title: t('sidebar.settings'), menuLabel: t('sidebar.settings'), active: section === 'settings', onClick: () => go(sectionPath('settings')) },
  ];

  if (header) {
    return (
      <Rail ref={railRef} mobile label={t('navigation.menu')}>
        <MainHeaderContent isMobile />
      </Rail>
    );
  }

  return (
    <Rail ref={railRef} mobile={!!isMobile} label={t('navigation.menu')}>
      <RailSeal
        src={darkMode.logo}
        alt="UiT"
        title="ChatUiT"
      />

      {!isMobile && <RailGap />}

      {isMobile && (
        <RailButton icon="chatNew" label={t('navigation.newChat')} active={newChat} onClick={() => go(NEW_CHAT_PATH)} />
      )}
      <RailButton icon={isMobile ? 'chat' : 'chatNew'} label={t('sidebar.chats')} active={chatsActive} onClick={() => go(isMobile ? sectionPath('chats') : '/')} />
      <RailButton icon="assistants" label={t('sidebar.assistants')} active={section === 'assistants'} onClick={() => go(sectionPath('assistants'))} />
      <RailButton icon="image" label={t('sidebar.generate')} active={section === 'generate'} onClick={() => go(sectionPath('generate'))} />
      {isAdmin && (
        <RailButton icon="admin" label={t('sidebar.admin')} active={section === 'admin'} onClick={() => go(sectionPath('admin'))} />
      )}
      {isAdmin && (
        <RailButton icon="pulse" label={t('sidebar.insights')} active={section === 'insights'} onClick={() => go(sectionPath('insights'))} />
      )}

      <RailSpacer />

      {!compact && secondaryItems.map(item => (
        <RailButton key={item.key} icon={item.icon} label={item.title} active={item.active} onClick={item.onClick} />
      ))}

      <Menu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
        <MenuTrigger
          render={compact ? (
            <RailIconButton iconSize="lg" icon="menu" label={t('navigation.menu')} tooltipPlacement="bottom" activeFill="none" active={userMenuOpen || secondaryItems.some(item => item.active)} />
          ) : (
            <RailIconButton
              icon={<RailAvatar>{getInitials(account?.name)}</RailAvatar>}
              label={account?.name || t('sidebar.profile')}
              tooltipPlacement={isMobile ? 'bottom' : 'right'}
            />
          )}
        />
        <MenuContent side={isMobile ? 'bottom' : 'right'} align="end" sideOffset={spacePx('sm')} className={floatingPanelClass('medium')}>
          <RailMenuHeader name={account?.name || t('sidebar.profile')} email={account?.username || undefined} />
          {compact ? (
            secondaryItems.map(item => (
              <MenuItem key={item.key} onSelect={item.onClick} aria-current={item.active ? 'page' : undefined}>
                <MenuItemIcon><Icon name={item.icon} size="sm" /></MenuItemIcon>
                {item.menuLabel}
              </MenuItem>
            ))
          ) : (
            <>
              <MenuItem onSelect={() => go(sectionPath('settings'))}>{t('sidebar.settings')}</MenuItem>
              <MenuItem onSelect={() => go(sectionPath('help'))}>{t('sidebar.help')}</MenuItem>
            </>
          )}
          <MenuSeparator />
          <MenuItem onSelect={openTraining}>
            {compact && <MenuItemIcon><Icon name="shield" size="sm" /></MenuItemIcon>}
            {t(trainingHasNewVersion ? 'training.menu.openNewVersion' : 'training.menu.open')}
          </MenuItem>
          {training?.completed && (
            <MenuItem onSelect={downloadCertificate}>
              {compact && <MenuItemIcon><Icon name="check" size="sm" /></MenuItemIcon>}
              {t('training.menu.certificate')}
            </MenuItem>
          )}
          {isAuthenticated ? (
            canSignOut && (
              <>
                <MenuSeparator />
                <MenuItem destructive onSelect={logout}>{t('sidebar.logout')}</MenuItem>
              </>
            )
          ) : (
            <>
              <MenuSeparator />
              <MenuItem onSelect={() => { void login(); }}>{t('sidebar.login')}</MenuItem>
            </>
          )}
        </MenuContent>
      </Menu>
    </Rail>
  );
};

export default IconRail;
