import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import Button from '../common/Button';
import NavItem from '../common/NavItem';
import SearchField from '../common/SearchField';
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
import { cx } from '../common/layout';
import './ContextColumn.css';

interface ContextColumnProps {
  isMobile?: boolean;
  // Hidden, and shown over the main column while peek is true
  collapsed?: boolean;
  peek?: boolean;
}

const SETTINGS_TABS: SettingsCategory[] = ['appearance', 'personalization', 'dataControl'];

const ContextColumn = ({ isMobile, collapsed, peek }: ContextColumnProps) => {
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
          <NavItem
            key={endpoint.id}
            level={2}
            active={activeAdminId === endpoint.id}
            onClick={() => navigate(`/admin/endpoints/${endpoint.id}`)}
            description={t(`admin.endpointType.${endpoint.endpointType}`)}
          >
            {endpoint.url}
          </NavItem>
        ));
      case 'models':
        return adminModels === undefined ? renderAdminLoading() : adminModels.map((model) => (
          <NavItem
            key={model.id}
            level={2}
            active={activeAdminId === model.id}
            onClick={() => navigate(`/admin/models/${model.id}`)}
            description={adminEndpoints?.find(endpoint => endpoint.id === model.endpointId)?.url ?? ''}
          >
            {model.modelName}
          </NavItem>
        ));
      case 'assistants':
        return adminAssistants === undefined ? renderAdminLoading() : adminAssistants.map((assistant) => (
          <NavItem
            key={assistant.id}
            level={2}
            active={activeAdminId === assistant.id}
            onClick={() => navigate(`/admin/assistants/${assistant.id}`)}
            description={assistant.description}
          >
            {assistant.name}
          </NavItem>
        ));
      case 'tools':
        return adminTools === undefined ? renderAdminLoading() : adminTools.map((tool) => (
          <NavItem
            key={tool.id}
            level={2}
            active={activeAdminId === tool.id}
            onClick={() => navigate(`/admin/tools/${tool.id}`)}
          >
            {toolboxLabel(tool, adminTools)}
          </NavItem>
        ));
      case 'agents':
        return adminInternalAgents === undefined ? renderAdminLoading() : adminInternalAgents.map((agent) => (
          <NavItem
            key={agent.id}
            level={2}
            active={activeAdminId === agent.id}
            onClick={() => navigate(`/admin/agents/${agent.id}`)}
            description={agent.modelId ? adminModels?.find(model => model.id === agent.modelId)?.modelName ?? agent.modelId : t('admin.agents.meta.notSet')}
          >
            {agent.name}
          </NavItem>
        ));
      case 'settings':
        return ADMIN_SETTINGS_PAGES.map((page) => (
          <NavItem
            key={page}
            level={2}
            active={activeAdminId === page}
            onClick={() => navigate(`/admin/settings/${page}`)}
          >
            {t(`admin.settings.pages.${page}`)}
          </NavItem>
        ));
    }
  };

  const className = cx('context-column', isMobile && 'context-column-mobile', collapsed && 'context-column-collapsed', peek && 'context-column-peek');

  return (
    <aside className={className}>
      <div className="context-column-header">
        <div className="t-overline">{titles[section]}</div>
        {count !== undefined && <div className="context-column-count t-meta">{count}</div>}
      </div>

      {section === 'chats' && (
        <>
          <div className="context-search-wrap">
            <SearchField
              size="small"
              value={query}
              onChange={setQuery}
              placeholder={t('contextColumn.searchChats')}
            />
          </div>
          <div className="context-column-scroll">
            <ChatList filter={query} />
          </div>
        </>
      )}

      {section === 'assistants' && (
        <div className="context-column-scroll">
          <NavItem active={activeAssistantId === undefined} onClick={() => navigate('/assistants')}>
            {t('assistants.overview')}
          </NavItem>
          <AssistantList activeId={activeAssistantId} />
          <Button
            variant="dashed"
            startIcon="add"
            fullWidth
            justify="start"
            mt="sm"
            active={activeAssistantId === 'new'}
            onClick={() => navigate('/assistants/new')}
          >
            {t('assistants.newAssistant')}
          </Button>
        </div>
      )}

      {section === 'settings' && (
        <div className="context-column-scroll">
          {SETTINGS_TABS.map((tabId) => (
            <NavItem
              key={tabId}
              active={activeSettingsTab === tabId}
              onClick={() => navigate(`/settings/${tabId}`)}
            >
              {t(`settings.categories.${tabId}`)}
            </NavItem>
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
          <NavItem icon="grid" active={activeAdminTab === undefined} onClick={() => navigate('/admin')}>
            {t('assistants.overview')}
          </NavItem>

          {ADMIN_DOMAINS.map((domain) => (
            <div key={domain}>
              <NavItem
                icon={ADMIN_DOMAIN_ICONS[domain]}
                active={activeAdminTab === domain && activeAdminId === undefined}
                onClick={() => navigate(domain === 'settings' ? `/admin/settings/${ADMIN_SETTINGS_PAGES[0]}` : `/admin/${domain}`)}
              >
                {t(`admin.tabs.${domain}`)}
              </NavItem>
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
