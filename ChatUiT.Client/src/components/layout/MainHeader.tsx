import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import Button from '../common/Button';
import IconButton from '../common/IconButton';
import { getChat } from '../../services/chatService';
import { getAssistants } from '../../services/assistantService';
import { conversationPanelOpenSignal, editorHeaderSignal } from '../../services/uiService';
import useMediaQuery from '../../hooks/useMediaQuery';
import type { SettingsCategory } from '../../types/settingsModels';
import { isHelpSection } from '../help/helpSections';
import Badge from '../common/Badge';

const SETTINGS_TABS: SettingsCategory[] = ['appearance', 'personalization', 'dataControl'];

interface MainHeaderProps {
  isMobile?: boolean;
}

/**
 * The thin header at the top of the main column — present in every section,
 * as in the design. Shows the current title, an optional context chip, the
 * conversation-panel toggle on chat pages, and a back-to-list button on mobile.
 */
const MainHeader = ({ isMobile }: MainHeaderProps) => {
  useSignals();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 1100px)');

  const pathParts = location.pathname.split('/').filter(Boolean);

  const section = location.pathname.startsWith('/assistants') ? 'assistants'
    : location.pathname.startsWith('/admin') ? 'admin'
    : location.pathname.startsWith('/settings') ? 'settings'
    : location.pathname.startsWith('/help') ? 'help'
    : location.pathname.startsWith('/status') ? 'status'
    : 'chats';

  const sectionTitles: Record<string, string> = {
    chats: t('contextColumn.chats'),
    assistants: t('contextColumn.assistants'),
    admin: t('contextColumn.admin'),
    settings: t('contextColumn.settings'),
    help: t('contextColumn.help'),
    status: t('contextColumn.status'),
  };

  const sectionRoots: Record<string, string> = {
    chats: '/',
    assistants: '/assistants',
    admin: '/admin',
    settings: '/settings',
    help: '/help',
    status: '/status',
  };

  // Chat: the header carries the conversation title
  const chatId = section === 'chats' && pathParts[0] === 'chat' && pathParts[1] && pathParts[1] !== 'new'
    ? pathParts[1]
    : undefined;
  const chat = chatId ? getChat(chatId).value : undefined;

  let title: string;
  let chip = '';

  if (section === 'chats') {
    title = chatId ? (chat?.name || '…') : t('chat.newChat');
  } else {
    title = sectionTitles[section];
    if (section === 'settings' && SETTINGS_TABS.includes(pathParts[1] as SettingsCategory)) {
      chip = t(`settings.categories.${pathParts[1]}`);
    } else if (section === 'assistants' && pathParts[1] && pathParts[1] !== 'new') {
      const assistantList = getAssistants().value;
      const all = assistantList
        ? [...assistantList.owned, ...assistantList.system, ...assistantList.shared]
        : [];
      chip = all.find(a => a.id === pathParts[1])?.name ?? '';
    } else if (section === 'admin' && pathParts[1]) {
      chip = t(`admin.tabs.${pathParts[1]}`, { defaultValue: '' });
    } else if (section === 'help' && isHelpSection(pathParts[1])) {
      chip = t(`help.sections.${pathParts[1]}`);
    }
  }

  const showPanelToggle = section === 'chats' && chatId !== undefined && isWide;
  const panelOpen = conversationPanelOpenSignal.value;

  // An open edit page: back to its list, and save/cancel once the form has changes
  const editor = editorHeaderSignal.value;

  return (
    <header className="main-header">
      {editor ? (
        <Button variant="ghost" startIcon="back" shrink minWidth="0" onClick={() => navigate(editor.backPath)}>
          {editor.backLabel}
        </Button>
      ) : isMobile && (
        <Button variant="ghost" startIcon="back" shrink minWidth="0" onClick={() => navigate(sectionRoots[section])}>
          {sectionTitles[section]}
        </Button>
      )}
      <div className="main-header-title t-title">{title}</div>
      {chip && !isMobile && <Badge tone="accent" size="medium" maxWidth="12rem">{chip}</Badge>}
      {editor?.dirty && (
        <>
          <Button variant="primary" size="small" onClick={editor.onSave} disabled={editor.saveDisabled}>
            {editor.saveLabel}
          </Button>
          <Button variant="secondary" size="small" onClick={editor.onCancel}>
            {t('common.cancel')}
          </Button>
        </>
      )}
      {showPanelToggle && (
        <IconButton
          icon="sidebarToggle"
          label={t('chat.togglePanel')}
          variant="subtle"
          size="small"
          active={panelOpen}
          onClick={() => { conversationPanelOpenSignal.value = !panelOpen; }}
        />
      )}
    </header>
  );
};

export default MainHeader;
