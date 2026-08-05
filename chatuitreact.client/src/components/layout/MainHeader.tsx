import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { Icon } from '../common/Icon';
import { getChat } from '../../services/chatService';
import { getAssistants } from '../../services/assistantService';
import { conversationPanelOpenSignal } from '../../services/uiService';
import useMediaQuery from '../../hooks/useMediaQuery';
import type { SettingsCategory } from '../../types/settingsModels';

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
    : 'chats';

  const sectionTitles: Record<string, string> = {
    chats: t('contextColumn.chats'),
    assistants: t('contextColumn.assistants'),
    admin: t('contextColumn.admin'),
    settings: t('contextColumn.settings'),
  };

  const sectionRoots: Record<string, string> = {
    chats: '/',
    assistants: '/assistants',
    admin: '/admin',
    settings: '/settings',
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
    }
  }

  const showPanelToggle = section === 'chats' && chatId !== undefined && isWide;
  const panelOpen = conversationPanelOpenSignal.value;

  return (
    <header className="main-header">
      {isMobile && (
        <button
          className="main-header-back t-ui"
          onClick={() => navigate(sectionRoots[section])}
        >
          <Icon name="back" size={1.125} />
          {sectionTitles[section]}
        </button>
      )}
      <div className="main-header-title t-title">{title}</div>
      {chip && !isMobile && <span className="main-header-chip t-chip">{chip}</span>}
      {showPanelToggle && (
        <button
          className={`main-header-action ${panelOpen ? 'active' : ''}`}
          onClick={() => { conversationPanelOpenSignal.value = !panelOpen; }}
          title={t('chat.togglePanel')}
        >
          <Icon name="sidebarToggle" size={1.0625} />
        </button>
      )}
    </header>
  );
};

export default MainHeader;
