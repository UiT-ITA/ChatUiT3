import React, { useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import './AdminPage.css';
import { adminEndpointsSignal, adminModelsSignal, adminAssistantsSignal, adminToolsSignal, adminInternalAgentsSignal, loadAdminData } from '../../services/adminDataService';
import EndpointEditor from './EndpointEditor';
import ModelEditor from './ModelEditor';
import AdminAssistantEditor from './AdminAssistantEditor';
import SettingsEditor from './SettingsEditor';
import ToolEditor from './ToolEditor';
import InternalAgentEditor from './InternalAgentEditor';
import { toolboxLabel, ADMIN_DOMAINS, ADMIN_DOMAIN_ICONS, ADMIN_SETTINGS_PAGES, type AdminDomain, type AdminSettingsPage } from '../../types/admin';
import ClassificationBadge from '../common/ClassificationBadge';
import { Icon } from '../common/Icon';
import Button from '../common/Button';
import { List, ListItem } from '../common/List';
import Stack from '../common/Stack';

const AdminPage: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const { tab, id } = useParams<{ tab?: string; id?: string }>();
  const navigate = useNavigate();

  const endpoints = adminEndpointsSignal.value;
  const models = adminModelsSignal.value;
  const assistants = adminAssistantsSignal.value;
  const tools = adminToolsSignal.value;
  const internalAgents = adminInternalAgentsSignal.value;

  const modelNameById = (id: string) =>
    models?.find(m => m.id === id)?.modelName ?? t('admin.settings.fields.none');

  useEffect(() => {
    loadAdminData();
  }, []);

  // Title, accent bar and intro shared by the admin overview and every domain overview
  const renderHeading = (title: string, intro: string) => (
    <>
      <h1 className="t-page-title">{title}</h1>
      <div className="page-title-bar" />
      <p className="admin-intro t-body-lg">{intro}</p>
    </>
  );

  const renderLoading = () => <div className="admin-empty t-ui-plain">{t('common.loading')}</div>;

  const renderEndpoints = () => (
    <>
      {renderHeading(t('admin.tabs.endpoints'), t('admin.domains.endpoints'))}
      {endpoints === undefined ? renderLoading() : (
        <Stack gap="sm">
          <List bordered>
            {endpoints.length === 0 && (
              <div className="admin-list-empty t-ui-plain">{t('admin.endpoints.list.empty')}</div>
            )}
            {endpoints.map((endpoint) => (
              <ListItem
                key={endpoint.id}
                onClick={() => navigate(`/admin/endpoints/${endpoint.id}`)}
                title={endpoint.url}
                trailing={t(`admin.endpointType.${endpoint.endpointType}`)}
              />
            ))}
          </List>
          <Button variant="dashed" startIcon="add" fullWidth onClick={() => navigate('/admin/endpoints/new')}>
            {t('admin.endpoints.add.title')}
          </Button>
        </Stack>
      )}
    </>
  );

  const renderModels = () => (
    <>
      {renderHeading(t('admin.tabs.models'), t('admin.domains.models'))}
      {models === undefined ? renderLoading() : (
        <Stack gap="sm">
          <List bordered>
            {models.length === 0 && (
              <div className="admin-list-empty t-ui-plain">{t('admin.models.list.empty')}</div>
            )}
            {models.map((model) => (
              <ListItem
                key={model.id}
                onClick={() => navigate(`/admin/models/${model.id}`)}
                title={model.modelName}
                description={endpoints?.find(e => e.id === model.endpointId)?.url ?? ''}
                trailing={<><ClassificationBadge classification={model.classification} />{model.modelId}</>}
              />
            ))}
          </List>
          <Button variant="dashed" startIcon="add" fullWidth onClick={() => navigate('/admin/models/new')}>
            {t('admin.models.add.title')}
          </Button>
        </Stack>
      )}
    </>
  );

  const renderAssistants = () => (
    <>
      {renderHeading(t('admin.tabs.assistants'), t('admin.domains.assistants'))}
      {assistants === undefined ? renderLoading() : (
        <Stack gap="sm">
          <List bordered>
            {assistants.length === 0 && (
              <div className="admin-list-empty t-ui-plain">{t('admin.assistants.list.empty')}</div>
            )}
            {assistants.map((assistant) => (
              <ListItem
                key={assistant.id}
                onClick={() => navigate(`/admin/assistants/${assistant.id}`)}
                title={assistant.name}
                description={assistant.description}
              />
            ))}
          </List>
          <Button variant="dashed" startIcon="add" fullWidth onClick={() => navigate('/admin/assistants/new')}>
            {t('admin.assistants.add.title')}
          </Button>
        </Stack>
      )}
    </>
  );

  const renderTools = () => (
    <>
      {renderHeading(t('admin.tabs.tools'), t('admin.domains.tools'))}
      {tools === undefined ? renderLoading() : (
        <List bordered>
          {tools.length === 0 && (
            <div className="admin-list-empty t-ui-plain">{t('admin.tools.list.empty')}</div>
          )}
          {tools.map((tool) => (
            <ListItem
              key={tool.id}
              onClick={() => navigate(`/admin/tools/${tool.id}`)}
              title={toolboxLabel(tool, tools)}
              description={tool.description}
              trailing={<ClassificationBadge classification={tool.classification} />}
            />
          ))}
        </List>
      )}
    </>
  );

  // Every internal agent definition and the model it runs on.
  const renderInternalAgents = () => (
    <>
      {renderHeading(t('admin.agents.title'), t('admin.agents.intro'))}
      {internalAgents === undefined ? renderLoading() : (
        <List bordered>
          {internalAgents.map((agent) => (
            <ListItem
              key={agent.id}
              onClick={() => navigate(`/admin/agents/${agent.id}`)}
              title={agent.name}
              description={agent.description}
              trailing={agent.modelId ? modelNameById(agent.modelId) : t('admin.agents.meta.notSet')}
            />
          ))}
        </List>
      )}
    </>
  );

  const domainCounts: Record<AdminDomain, number | undefined> = {
    endpoints: endpoints?.length,
    models: models?.length,
    assistants: assistants?.length,
    tools: tools?.length,
    agents: internalAgents?.length,
    settings: undefined,
  };

  // Admin overview — one row per domain; clicking a row opens that domain
  const renderOverview = () => (
    <>
      {renderHeading(t('contextColumn.admin'), t('admin.intro'))}
      <List bordered>
        {ADMIN_DOMAINS.map((domain) => (
          <ListItem
            key={domain}
            onClick={() => navigate(domain === 'settings' ? `/admin/settings/${ADMIN_SETTINGS_PAGES[0]}` : `/admin/${domain}`)}
            title={t(`admin.tabs.${domain}`)}
            description={t(`admin.domains.${domain}`)}
            leading={<Icon name={ADMIN_DOMAIN_ICONS[domain]} size="large" color="muted" />}
            trailing={domainCounts[domain] !== undefined && domainCounts[domain]}
          />
        ))}
      </List>
    </>
  );

  const renderContent = () => {
    if (tab === 'settings') {
      if (!ADMIN_SETTINGS_PAGES.includes(id as AdminSettingsPage)) {
        return <Navigate to={`/admin/settings/${ADMIN_SETTINGS_PAGES[0]}`} replace />;
      }
      return <SettingsEditor />;
    }
    if (tab === 'endpoints' && id) {
      return <EndpointEditor endpointId={id === 'new' ? undefined : id} />;
    }
    if (tab === 'models' && id) {
      return <ModelEditor modelId={id === 'new' ? undefined : id} />;
    }
    if (tab === 'assistants' && id) {
      return <AdminAssistantEditor assistantId={id === 'new' ? undefined : id} />;
    }
    if (tab === 'tools' && id) {
      return <ToolEditor toolId={id} />;
    }
    if (tab === 'agents' && id) {
      return <InternalAgentEditor key={id} agentId={id} />;
    }
    if (tab === 'endpoints') return renderEndpoints();
    if (tab === 'models') return renderModels();
    if (tab === 'assistants') return renderAssistants();
    if (tab === 'tools') return renderTools();
    if (tab === 'agents') return renderInternalAgents();
    return renderOverview();
  };

  return (
    <div className="admin-page">
      <div className="admin-page-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminPage;
