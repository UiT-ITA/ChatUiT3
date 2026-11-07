import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import Button from '../common/Button';
import NavItem from '../common/NavItem';
import { INSIGHTS_TABS, INSIGHTS_TAB_ICONS, isInsightsTab } from '../../types/insights';
import type { IconName } from '../common/Icon';
import SearchField from '../common/SearchField';
import { ChatList } from '../chat/ChatList';
import { AssistantList } from '../assistants/AssistantList';
import { getChats } from '../../services/chatService';
import { getAssistants } from '../../services/assistantService';
import { getGenerations } from '../../services/mediaGenerationService';
import { adminEndpointsSignal, adminModelsSignal, adminAssistantsSignal, adminToolsSignal, adminInternalAgentsSignal, loadAdminData } from '../../services/adminDataService';
import { useAuth } from '../../hooks/useAuth';
import { toolboxLabel, ADMIN_DOMAINS, ADMIN_DOMAIN_ICONS, ADMIN_SETTINGS_PAGES, type AdminDomain } from '../../types/admin';
import type { SettingsCategory } from '../../types/settingsModels';
import { MODEL_TYPES } from '../../types/modelModels';
import { HELP_SECTIONS, isHelpSection } from '../help/helpSections';
import HelpSectionNav from '../help/HelpSectionNav';
import { NEW_CHAT_PATH, parseRoute, type Section } from '../../utils/routes';
import { SideColumn, SideColumnChildren, SideColumnEmpty, SideColumnGroupLabel, SideColumnHeader, SideColumnNote, SideColumnPageHead, SideColumnScroll, SideColumnSearch } from './AppShell';

interface ContextColumnProps {
  isMobile?: boolean;
  // Hidden, and shown over the main column while peek is true
  collapsed?: boolean;
  peek?: boolean;
}

const SETTINGS_TABS: SettingsCategory[] = ['appearance', 'personalization', 'dataControl'];

const SETTINGS_TAB_ICONS: Record<SettingsCategory, IconName> = {
  appearance: 'sun',
  personalization: 'user',
  dataControl: 'lock',
};

/** A dashed button that opens a new item. */
const AddButton = (props: React.ComponentProps<typeof Button>) => (
  <Button variant="dashed" startIcon="add" fullWidth justify="start" {...props} />
);

const ContextColumn = ({ isMobile, collapsed, peek }: ContextColumnProps) => {
  useSignals();
  const { t } = useTranslation();
  const { section, params } = parseRoute(useLocation().pathname);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (section === 'admin' && isAdmin) {
      loadAdminData();
    }
  }, [section, isAdmin]);

  const chats = getChats();
  const assistants = getAssistants();
  const generations = section === 'generate' ? getGenerations().value : undefined;

  const count = section === 'chats' && chats.value !== undefined
    ? chats.value.length
    : section === 'assistants' && assistants.value !== undefined
      ? assistants.value.owned.length + assistants.value.system.length + assistants.value.shared.length
      : undefined;

  const title = t(`contextColumn.${section}`);

  const intros: Partial<Record<Section, string>> = {
    assistants: t('assistants.intro'),
    generate: t('generate.intro'),
    admin: t('admin.intro'),
    insights: t('insights.intro'),
  };

  // The open tab or item of the section, and the open item of an admin tab
  const [activeId, activeAdminId] = params;
  const activeSettingsTab = SETTINGS_TABS.includes(activeId as SettingsCategory) ? activeId : 'appearance';
  const activeHelpSection = isHelpSection(activeId) ? activeId : HELP_SECTIONS[0];
  const activeInsightsTab = isInsightsTab(activeId) ? activeId : INSIGHTS_TABS[0];

  const loading = <SideColumnNote>{t('common.loading')}</SideColumnNote>;
  const adminItem = (domain: AdminDomain, id: string, label: string, description?: string) => (
    <NavItem key={id} level={2} active={activeAdminId === id} onClick={() => navigate(`/admin/${domain}/${id}`)} description={description}>
      {label}
    </NavItem>
  );

  // The items of the open admin domain, shown under its row in the sidebar
  const renderAdminDomainItems = (domain: AdminDomain) => {
    const endpoints = adminEndpointsSignal.value;
    const models = adminModelsSignal.value;
    switch (domain) {
      case 'endpoints':
        return endpoints?.map(endpoint => adminItem(domain, endpoint.id, endpoint.url, t(`admin.endpointType.${endpoint.endpointType}`))) ?? loading;
      case 'models':
        return models === undefined ? loading : MODEL_TYPES.map((type) => {
          const ofType = models.filter(model => model.type === type);
          return ofType.length > 0 && (
            <div key={type}>
              <SideColumnGroupLabel>{t(`admin.modelTypes.${type}.title`)}</SideColumnGroupLabel>
              {ofType.map(model => adminItem(domain, model.id, model.modelName, endpoints?.find(endpoint => endpoint.id === model.endpointId)?.url ?? ''))}
            </div>
          );
        });
      case 'assistants':
        return adminAssistantsSignal.value?.map(assistant => adminItem(domain, assistant.id, assistant.name, assistant.description)) ?? loading;
      case 'tools':
        return adminToolsSignal.value?.map((tool, _, tools) => adminItem(domain, tool.id, toolboxLabel(tool, tools))) ?? loading;
      case 'agents':
        return adminInternalAgentsSignal.value?.map(agent => adminItem(domain, agent.id, agent.name,
          agent.modelId ? models?.find(model => model.id === agent.modelId)?.modelName ?? agent.modelId : t('admin.agents.meta.notSet'))) ?? loading;
      case 'settings':
        return ADMIN_SETTINGS_PAGES.map(page => adminItem(domain, page, t(`admin.settings.pages.${page}`)));
    }
  };

  return (
    <SideColumn mobile={!!isMobile} collapsed={collapsed} peek={peek}>
      {isMobile ? (
        <SideColumnPageHead title={title} intro={intros[section]} />
      ) : (
        <SideColumnHeader title={title} count={count} />
      )}

      {section === 'chats' && (
        <>
          <SideColumnSearch>
            {isMobile && (
              <Button variant="primary" fullWidth justify="center" mb="sm" onClick={() => navigate(NEW_CHAT_PATH)}>
                {t('sidebar.newChat')}
              </Button>
            )}
            <SearchField
              size="small"
              value={query}
              onChange={setQuery}
              placeholder={t('contextColumn.searchChats')}
            />
          </SideColumnSearch>
          <SideColumnScroll>
            <ChatList filter={query} />
          </SideColumnScroll>
        </>
      )}

      {section === 'assistants' && (
        <SideColumnScroll>
          {/* The overview row. On mobile the section root shows the list. */}
          {!isMobile && <NavItem active={activeId === undefined} onClick={() => navigate('/assistants')}>{t('assistants.overview')}</NavItem>}
          <AssistantList activeId={activeId} />
          <AddButton mt="sm" active={activeId === 'new'} onClick={() => navigate('/assistants/new')}>
            {t('assistants.newAssistant')}
          </AddButton>
        </SideColumnScroll>
      )}

      {section === 'generate' && (
        <SideColumnScroll>
          <AddButton mb="sm" active={activeId === undefined} onClick={() => navigate('/generate')}>
            {t('generate.newGeneration')}
          </AddButton>
          {generations === undefined ? loading : generations.length === 0 ? (
            <SideColumnEmpty icon="image" title={t('generate.empty')} hint={t('generate.emptyHint')} />
          ) : generations.map((generation) => (
            <NavItem
              key={generation.id}
              active={activeId === generation.id}
              onClick={() => navigate(`/generate/${generation.id}`)}
              description={`${generation.modelName} · ${t(`generate.status.${generation.status}`)}`}
            >
              {generation.prompt}
            </NavItem>
          ))}
        </SideColumnScroll>
      )}

      {section === 'settings' && (
        <SideColumnScroll>
          {SETTINGS_TABS.map((tabId) => (
            <NavItem
              key={tabId}
              icon={SETTINGS_TAB_ICONS[tabId]}
              active={activeSettingsTab === tabId}
              onClick={() => navigate(`/settings/${tabId}`)}
            >
              {t(`settings.categories.${tabId}`)}
            </NavItem>
          ))}
        </SideColumnScroll>
      )}

      {section === 'help' && (
        <SideColumnScroll>
          <HelpSectionNav activeSection={activeHelpSection} />
        </SideColumnScroll>
      )}

      {section === 'insights' && isAdmin && (
        <SideColumnScroll>
          {INSIGHTS_TABS.map((tabId) => (
            <NavItem
              key={tabId}
              icon={INSIGHTS_TAB_ICONS[tabId]}
              active={activeInsightsTab === tabId}
              onClick={() => navigate(`/insights/${tabId}`)}
            >
              {t(`insights.tabs.${tabId}`)}
            </NavItem>
          ))}
        </SideColumnScroll>
      )}

      {section === 'admin' && (
        <SideColumnScroll>
          {!isMobile && <NavItem icon="grid" active={activeId === undefined} onClick={() => navigate('/admin')}>{t('assistants.overview')}</NavItem>}

          {ADMIN_DOMAINS.map((domain) => (
            <div key={domain}>
              <NavItem
                icon={ADMIN_DOMAIN_ICONS[domain]}
                active={activeId === domain && activeAdminId === undefined}
                onClick={() => navigate(domain === 'settings' ? `/admin/settings/${ADMIN_SETTINGS_PAGES[0]}` : `/admin/${domain}`)}
              >
                {t(`admin.tabs.${domain}`)}
              </NavItem>
              {activeId === domain && (
                <SideColumnChildren>
                  {renderAdminDomainItems(domain)}
                </SideColumnChildren>
              )}
            </div>
          ))}
        </SideColumnScroll>
      )}
    </SideColumn>
  );
};

export default ContextColumn;
