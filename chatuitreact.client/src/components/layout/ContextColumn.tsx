import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { Icon } from '../common/Icon';
import { ChatList } from '../chat/ChatList';
import { AssistantList } from '../assistants/AssistantList';
import { getChats } from '../../services/chatService';
import { getAssistants } from '../../services/assistantService';
import { adminEndpointsSignal, adminModelsSignal, adminAssistantsSignal, loadAdminData } from '../../services/adminDataService';
import { useAuth } from '../../contexts/AuthContext';
import type { SettingsCategory } from '../../types/settingsModels';
import { HELP_SECTIONS, isHelpSection } from '../help/helpSections';
import HelpSectionNav from '../help/HelpSectionNav';
import './ContextColumn.css';

interface ContextColumnProps {
  isMobile?: boolean;
}

const SETTINGS_TABS: SettingsCategory[] = ['appearance', 'personalization', 'dataControl'];

const ContextColumn = ({ isMobile }: ContextColumnProps) => {
  useSignals();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState('');

  const pathParts = location.pathname.split('/').filter(Boolean);

  const section = location.pathname.startsWith('/assistants') ? 'assistants'
    : location.pathname.startsWith('/admin') ? 'admin'
    : location.pathname.startsWith('/settings') ? 'settings'
    : location.pathname.startsWith('/help') ? 'help'
    : 'chats';

  useEffect(() => {
    if (section === 'admin' && isAdmin) {
      loadAdminData();
    }
  }, [section, isAdmin]);

  const chats = getChats();
  const assistants = getAssistants();
  const adminEndpoints = adminEndpointsSignal.value;
  const adminModels = adminModelsSignal.value;
  const adminAssistants = adminAssistantsSignal.value;

  const count = section === 'chats' && chats.value !== undefined
    ? chats.value.length
    : section === 'assistants' && assistants.value !== undefined
      ? assistants.value.owned.length + assistants.value.system.length + assistants.value.shared.length
      : section === 'admin' && adminEndpoints !== undefined
        ? adminEndpoints.length + (adminModels?.length ?? 0) + (adminAssistants?.length ?? 0)
        : undefined;

  const titles: Record<string, string> = {
    chats: t('contextColumn.chats'),
    assistants: t('contextColumn.assistants'),
    admin: t('contextColumn.admin'),
    settings: t('contextColumn.settings'),
    help: t('contextColumn.help'),
  };

  const activeSettingsTab: SettingsCategory =
    section === 'settings' && SETTINGS_TABS.includes(pathParts[1] as SettingsCategory)
      ? pathParts[1] as SettingsCategory
      : 'appearance';

  const activeHelpSection = section === 'help'
    ? (isHelpSection(pathParts[1]) ? pathParts[1] : HELP_SECTIONS[0])
    : undefined;

  const activeAdminTab = section === 'admin' ? pathParts[1] : undefined;
  const activeAdminId = section === 'admin' ? pathParts[2] : undefined;

  const activeAssistantId = section === 'assistants' ? pathParts[1] : undefined;

  const adminNav = (path: string) => {
    navigate(path);
  };

  const className = isMobile ? 'context-column context-column-mobile' : 'context-column';

  return (
    <aside className={className}>
      <div className="context-column-header">
        <div className="t-overline">{titles[section]}</div>
        {count !== undefined && <div className="context-column-count t-meta">{count}</div>}
      </div>

      {section === 'chats' && (
        <>
          <div className="context-search-wrap">
            <div className="context-search">
              <Icon name="search" size={0.9375} className="context-search-icon" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('contextColumn.searchChats')}
                className="t-ui-plain"
              />
              {query.length > 0 && (
                <button className="context-search-clear" onClick={() => setQuery('')} title={t('common.clear')}>
                  <Icon name="close" size={0.875} />
                </button>
              )}
            </div>
          </div>
          <div className="context-column-scroll">
            <ChatList filter={query} />
          </div>
        </>
      )}

      {section === 'assistants' && (
        <div className="context-column-scroll">
          <button
            className={`context-nav-row t-ui ${activeAssistantId === undefined ? 'active' : ''}`}
            onClick={() => navigate('/assistants')}
          >
            {t('assistants.overview')}
          </button>
          <AssistantList activeId={activeAssistantId} />
          <button
            className={`context-add-row t-ui ${activeAssistantId === 'new' ? 'active' : ''}`}
            onClick={() => navigate('/assistants/new')}
          >
            + {t('assistants.newAssistant')}
          </button>
        </div>
      )}

      {section === 'settings' && (
        <div className="context-column-scroll">
          {SETTINGS_TABS.map((tabId) => (
            <button
              key={tabId}
              className={`context-nav-row t-ui ${activeSettingsTab === tabId ? 'active' : ''}`}
              onClick={() => navigate(`/settings/${tabId}`)}
            >
              {t(`settings.categories.${tabId}`)}
            </button>
          ))}
        </div>
      )}

      {section === 'help' && activeHelpSection && (
        <div className="context-column-scroll">
          <HelpSectionNav activeSection={activeHelpSection} />
        </div>
      )}

      {section === 'admin' && (
        <div className="context-column-scroll">
          <button
            className={`context-nav-row t-ui ${activeAdminTab === undefined ? 'active' : ''}`}
            onClick={() => adminNav('/admin')}
          >
            {t('assistants.overview')}
          </button>

          <div className="context-group-label t-group-label">{t('admin.tabs.endpoints')}</div>
          {adminEndpoints === undefined ? (
            <div className="context-column-note t-ui-plain">{t('common.loading')}</div>
          ) : (
            adminEndpoints.map((endpoint) => (
              <button
                key={endpoint.id}
                className={`context-nav-row context-list-row t-ui ${activeAdminTab === 'endpoints' && activeAdminId === endpoint.id ? 'active' : ''}`}
                onClick={() => adminNav(`/admin/endpoints/${endpoint.id}`)}
              >
                <span className="context-list-row-title">{endpoint.url}</span>
                <span className="context-list-row-meta t-meta">{t(`admin.endpointType.${endpoint.endpointType}`)}</span>
              </button>
            ))
          )}
          <button
            className={`context-add-row t-ui ${activeAdminTab === 'endpoints' && activeAdminId === 'new' ? 'active' : ''}`}
            onClick={() => adminNav('/admin/endpoints/new')}
          >
            + {t('admin.endpoints.add.title')}
          </button>

          <div className="context-group-label t-group-label">{t('admin.tabs.models')}</div>
          {adminModels === undefined ? (
            <div className="context-column-note t-ui-plain">{t('common.loading')}</div>
          ) : (
            adminModels.map((model) => (
              <button
                key={model.id}
                className={`context-nav-row context-list-row t-ui ${activeAdminTab === 'models' && activeAdminId === model.id ? 'active' : ''}`}
                onClick={() => adminNav(`/admin/models/${model.id}`)}
              >
                <span className="context-list-row-title">{model.modelName}</span>
                <span className="context-list-row-meta t-meta">{model.modelId}</span>
              </button>
            ))
          )}
          <button
            className={`context-add-row t-ui ${activeAdminTab === 'models' && activeAdminId === 'new' ? 'active' : ''}`}
            onClick={() => adminNav('/admin/models/new')}
          >
            + {t('admin.models.add.title')}
          </button>

          <div className="context-group-label t-group-label">{t('admin.tabs.assistants')}</div>
          {adminAssistants === undefined ? (
            <div className="context-column-note t-ui-plain">{t('common.loading')}</div>
          ) : (
            adminAssistants.map((assistant) => (
              <button
                key={assistant.id}
                className={`context-nav-row context-list-row t-ui ${activeAdminTab === 'assistants' && activeAdminId === assistant.id ? 'active' : ''}`}
                onClick={() => adminNav(`/admin/assistants/${assistant.id}`)}
              >
                <span className="context-list-row-title">{assistant.name}</span>
                {assistant.description && (
                  <span className="context-list-row-sub t-caption">{assistant.description}</span>
                )}
              </button>
            ))
          )}
          <button
            className={`context-add-row t-ui ${activeAdminTab === 'assistants' && activeAdminId === 'new' ? 'active' : ''}`}
            onClick={() => adminNav('/admin/assistants/new')}
          >
            + {t('admin.assistants.add.title')}
          </button>

          <div className="context-group-label t-group-label">{t('admin.tabs.settings')}</div>
          <button
            className={`context-nav-row t-ui ${activeAdminTab === 'settings' ? 'active' : ''}`}
            onClick={() => adminNav('/admin/settings')}
          >
            {t('admin.settings.title')}
          </button>
        </div>
      )}
    </aside>
  );
};

export default ContextColumn;
