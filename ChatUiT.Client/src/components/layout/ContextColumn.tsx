import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { Icon } from '../common/Icon';
import { ChatList } from '../chat/ChatList';
import { AssistantList } from '../assistants/AssistantList';
import { getChats } from '../../services/chatService';
import { getAssistants } from '../../services/assistantService';
import { adminEndpointsSignal, adminModelsSignal, adminAssistantsSignal, adminToolsSignal, adminInternalAgentsSignal, loadAdminData } from '../../services/adminDataService';
import { useAuth } from '../../hooks/useAuth';
import { toolboxLabel, ADMIN_DOMAINS, ADMIN_DOMAIN_ICONS, ADMIN_SETTINGS_PAGES, type AdminDomain } from '../../types/admin';
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
    : location.pathname.startsWith('/status') ? 'status'
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
  const adminTools = adminToolsSignal.value;
  const adminInternalAgents = adminInternalAgentsSignal.value;

  const count = section === 'chats' && chats.value !== undefined
    ? chats.value.length
    : section === 'assistants' && assistants.value !== undefined
      ? assistants.value.owned.length + assistants.value.system.length + assistants.value.shared.length
      : undefined;

  const titles: Record<string, string> = {
    chats: t('contextColumn.chats'),
    assistants: t('contextColumn.assistants'),
    admin: t('contextColumn.admin'),
    settings: t('contextColumn.settings'),
    help: t('contextColumn.help'),
    status: t('contextColumn.status'),
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

  const renderAdminLoading = () => (
    <div className="context-column-note t-ui-plain">{t('common.loading')}</div>
  );

  // The items of the open admin domain, shown under its row in the sidebar
  const renderAdminDomainItems = (domain: AdminDomain) => {
    switch (domain) {
      case 'endpoints':
        return adminEndpoints === undefined ? renderAdminLoading() : adminEndpoints.map((endpoint) => (
          <button
            key={endpoint.id}
            className={`context-nav-row context-list-row t-ui-plain ${activeAdminId === endpoint.id ? 'active' : ''}`}
            onClick={() => navigate(`/admin/endpoints/${endpoint.id}`)}
          >
            <span className="context-list-row-title">{endpoint.url}</span>
            <span className="context-list-row-meta t-caption">{t(`admin.endpointType.${endpoint.endpointType}`)}</span>
          </button>
        ));
      case 'models':
        return adminModels === undefined ? renderAdminLoading() : adminModels.map((model) => (
          <button
            key={model.id}
            className={`context-nav-row context-list-row t-ui-plain ${activeAdminId === model.id ? 'active' : ''}`}
            onClick={() => navigate(`/admin/models/${model.id}`)}
          >
            <span className="context-list-row-title">{model.modelName}</span>
            <span className="context-list-row-meta t-caption">{adminEndpoints?.find(endpoint => endpoint.id === model.endpointId)?.url ?? ''}</span>
          </button>
        ));
      case 'assistants':
        return adminAssistants === undefined ? renderAdminLoading() : adminAssistants.map((assistant) => (
          <button
            key={assistant.id}
            className={`context-nav-row context-list-row t-ui-plain ${activeAdminId === assistant.id ? 'active' : ''}`}
            onClick={() => navigate(`/admin/assistants/${assistant.id}`)}
          >
            <span className="context-list-row-title">{assistant.name}</span>
            {assistant.description && (
              <span className="context-list-row-sub t-caption">{assistant.description}</span>
            )}
          </button>
        ));
      case 'tools':
        return adminTools === undefined ? renderAdminLoading() : adminTools.map((tool) => (
          <button
            key={tool.id}
            className={`context-nav-row context-list-row t-ui-plain ${activeAdminId === tool.id ? 'active' : ''}`}
            onClick={() => navigate(`/admin/tools/${tool.id}`)}
          >
            <span className="context-list-row-title">{toolboxLabel(tool, adminTools)}</span>
          </button>
        ));
      case 'agents':
        return adminInternalAgents === undefined ? renderAdminLoading() : adminInternalAgents.map((agent) => (
          <button
            key={agent.id}
            className={`context-nav-row context-list-row t-ui-plain ${activeAdminId === agent.id ? 'active' : ''}`}
            onClick={() => navigate(`/admin/agents/${agent.id}`)}
          >
            <span className="context-list-row-title">{agent.name}</span>
            <span className="context-list-row-meta t-caption">
              {agent.modelId ? adminModels?.find(model => model.id === agent.modelId)?.modelName ?? agent.modelId : t('admin.agents.meta.notSet')}
            </span>
          </button>
        ));
      case 'settings':
        return ADMIN_SETTINGS_PAGES.map((page) => (
          <button
            key={page}
            className={`context-nav-row t-ui-plain ${activeAdminId === page ? 'active' : ''}`}
            onClick={() => navigate(`/admin/settings/${page}`)}
          >
            {t(`admin.settings.pages.${page}`)}
          </button>
        ));
    }
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
            className={`context-nav-row context-icon-row t-ui ${activeAdminTab === undefined ? 'active' : ''}`}
            onClick={() => navigate('/admin')}
          >
            <Icon name="grid" size={1} className="context-icon-row-icon" />
            {t('assistants.overview')}
          </button>

          {ADMIN_DOMAINS.map((domain) => (
            <div key={domain}>
              <button
                className={`context-nav-row context-icon-row t-ui ${activeAdminTab === domain && activeAdminId === undefined ? 'active' : ''}`}
                onClick={() => navigate(domain === 'settings' ? `/admin/settings/${ADMIN_SETTINGS_PAGES[0]}` : `/admin/${domain}`)}
              >
                <Icon name={ADMIN_DOMAIN_ICONS[domain]} size={1} className="context-icon-row-icon" />
                {t(`admin.tabs.${domain}`)}
              </button>
              {activeAdminTab === domain && (
                <div className="context-nav-children">
                  {renderAdminDomainItems(domain)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

export default ContextColumn;
