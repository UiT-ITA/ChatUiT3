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
import { parseRoute, sectionPath } from '../../utils/routes';

/**
 * The thin header at the top of the main column, in every section. Shows the sidebar toggle when
 * onToggleSidebar is set, the current title, an optional context chip, the conversation-panel toggle
 * on chat pages, and a back control on edit pages and on mobile detail views.
 */
const MainHeader = ({ isMobile, sidebarCollapsed, onToggleSidebar }: { isMobile?: boolean; sidebarCollapsed?: boolean; onToggleSidebar?: () => void }) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isWide = useMediaQuery(WIDE);
  const { section, params, chatId, newChat, view } = parseRoute(useLocation().pathname);
  const sectionTitle = t(`contextColumn.${section}`);
  const chat = chatId ? getChat(chatId).value : undefined;

  let title = sectionTitle;
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

  // An open edit page: back to its list, and save/cancel once the form has changes
  const editor = editorHeaderSignal.value;

  // The back control: to the list of an open edit page, or to the section root from a mobile detail view
  const back = editor
    ? { path: editor.backPath, label: editor.backLabel }
    : isMobile && view === 'detail' && !newChat
      ? { path: sectionPath(section), label: sectionTitle }
      : undefined;

  return (
    <AppHeader back={back !== undefined}>
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
    </AppHeader>
  );
};

export default MainHeader;
