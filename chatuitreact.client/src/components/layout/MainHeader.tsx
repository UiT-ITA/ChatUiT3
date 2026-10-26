import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { Icon } from '../common/Icon';
import ClassificationBadge from '../common/ClassificationBadge';
import { getChat, getCurrentAssistantId, getRedEnabled, enableRed } from '../../services/chatService';
import { getAssistant, getAssistants } from '../../services/assistantService';
import { chatClassification } from '../../types/modelModels';
import { conversationPanelOpenSignal } from '../../services/uiService';
import useMediaQuery from '../../hooks/useMediaQuery';
import type { SettingsCategory } from '../../types/settingsModels';
import { isHelpSection } from '../help/helpSections';

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

  // Chat: the classification of the conversation, and the switch that allows red data
  const currentAssistantId = getCurrentAssistantId().value;
  const assistant = section === 'chats' && currentAssistantId ? getAssistant(currentAssistantId).value : undefined;
  const redEnabled = getRedEnabled().value;
  const showRedToggle = assistant?.classification === 'Red';

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
      {assistant && (
        <ClassificationBadge classification={chatClassification(assistant.classification, redEnabled)} />
      )}
      {showRedToggle && (
        <label className="main-header-red-toggle t-meta" title={t(redEnabled ? 'chat.redToggle.enabled' : 'chat.redToggle.enable')}>
          {t('chat.redToggle.label')}
          <button
            type="button"
            className={`main-header-red-toggle-pill ${redEnabled ? 'on' : ''}`}
            onClick={() => { void enableRed(); }}
            disabled={redEnabled}
            aria-pressed={redEnabled}
            aria-label={t('chat.redToggle.label')}
          >
            <span className="main-header-red-toggle-knob" />
          </button>
        </label>
      )}
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
