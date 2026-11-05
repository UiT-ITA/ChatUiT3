import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import Button from '../common/Button';
import IconButton from '../common/IconButton';
import { Icon } from '../common/Icon';
import { getChat } from '../../services/chatService';
import { getAssistants } from '../../services/assistantService';
import { conversationPanelOpenSignal, editorHeaderSignal } from '../../services/uiService';
import useMediaQuery from '../../hooks/useMediaQuery';
import { isHelpSection } from '../help/helpSections';
import Badge from '../common/Badge';
import { AppHeader, AppHeaderCrumb, AppHeaderStatus, AppHeaderTitle } from './AppShell';
import { WIDE } from '../common/breakpoints';
import { parseRoute } from '../../utils/routes';
import { useHeaderBack } from './useHeaderBack';

interface MainHeaderProps {
  isMobile?: boolean;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

/**
 * The content of the main column header. Shows the sidebar toggle when onToggleSidebar is set, the current
 * title, an optional context chip, the conversation-panel toggle on chat pages, and a back control on edit
 * pages and on mobile detail views.
 */
export const MainHeaderContent = ({ isMobile, sidebarCollapsed, onToggleSidebar }: MainHeaderProps) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isWide = useMediaQuery(WIDE);
  const { section, params, chatId } = parseRoute(useLocation().pathname);
  const back = useHeaderBack(isMobile);
  const chat = chatId ? getChat(chatId).value : undefined;

  let title = t(`contextColumn.${section}`);
  let chip = '';

  if (section === 'chats') {
    title = chatId ? (chat?.name || '…') : t('chat.newChat');
  } else if (section === 'assistants' && params[0] && params[0] !== 'new') {
    const list = getAssistants().value;
    title = [...(list?.owned ?? []), ...(list?.system ?? []), ...(list?.shared ?? [])].find(a => a.id === params[0])?.name ?? title;
  } else if (section === 'settings' && params[0]) {
    chip = t(`settings.categories.${params[0]}`, { defaultValue: '' });
  } else if (section === 'admin' && params[0]) {
    chip = t(`admin.tabs.${params[0]}`, { defaultValue: '' });
  } else if (section === 'help' && isHelpSection(params[0])) {
    chip = t(`help.sections.${params[0]}`);
  }

  // An open edit page: save/cancel once the form has changes
  const editor = editorHeaderSignal.value;

  return (
    <>
      {onToggleSidebar && (
        <IconButton icon="sidebarToggle" iconSize="md" label={t(sidebarCollapsed ? 'sidebar.expandSidebar' : 'sidebar.collapseSidebar')} variant="ghost" size="small" onClick={onToggleSidebar} />
      )}
      {back && (isMobile ? (
        <IconButton icon="back" label={back.label} variant="ghost" onClick={() => navigate(back.path)} />
      ) : (
        <AppHeaderCrumb onClick={() => navigate(back.path)}>{back.label}</AppHeaderCrumb>
      ))}
      <AppHeaderTitle>{title}</AppHeaderTitle>
      {chip && !isMobile && <Badge tone="accent" size="medium" maxWidth="2xs">{chip}</Badge>}
      {editor && !editor.dirty && (
        <AppHeaderStatus title={t('common.allChangesSaved')}>
          <Icon name="check" size="sm" color="success" />
          {isMobile ? t('common.saved') : t('common.allChangesSaved')}
        </AppHeaderStatus>
      )}
      {editor?.dirty && (
        <>
          <Button variant="primary" size="small" onClick={editor.onSave} disabled={editor.saveDisabled}>{editor.saveLabel}</Button>
          <Button variant="secondary" size="small" onClick={editor.onCancel}>{t('common.cancel')}</Button>
        </>
      )}
      {section === 'chats' && chatId !== undefined && isWide && (
        <IconButton
          icon={<Icon name="sidebarToggle" size="md" mirror />}
          label={t('chat.togglePanel')}
          variant="ghost"
          size="small"
          onClick={() => { conversationPanelOpenSignal.value = !conversationPanelOpenSignal.value; }}
        />
      )}
    </>
  );
};

/** The thin header at the top of the main column. On mobile views with a back control, the top bar shows its content instead. */
const MainHeader = (props: MainHeaderProps) => {
  useSignals();
  const back = useHeaderBack(props.isMobile);
  if (props.isMobile && back) return null;
  return (
    <AppHeader>
      <MainHeaderContent {...props} />
    </AppHeader>
  );
};

export default MainHeader;
