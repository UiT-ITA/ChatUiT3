import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import './AdminPage.css';
import { adminEndpointsSignal, adminModelsSignal, adminAssistantsSignal, adminSettingsSignal, adminToolsSignal, adminInternalAgentsSignal, loadAdminData } from '../../services/adminDataService';
import EndpointEditor from './EndpointEditor';
import ModelEditor from './ModelEditor';
import AdminAssistantEditor from './AdminAssistantEditor';
import SettingsEditor from './SettingsEditor';
import ToolEditor from './ToolEditor';
import InternalAgentEditor from './InternalAgentEditor';
import { toolboxLabel } from '../../types/admin';
import ClassificationBadge from '../common/ClassificationBadge';

const AdminPage: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const { tab, id } = useParams<{ tab?: string; id?: string }>();
  const navigate = useNavigate();

  const endpoints = adminEndpointsSignal.value;
  const models = adminModelsSignal.value;
  const assistants = adminAssistantsSignal.value;
  const settings = adminSettingsSignal.value;
  const tools = adminToolsSignal.value;
  const internalAgents = adminInternalAgentsSignal.value;

  const modelNameById = (id: string) =>
    models?.find(m => m.id === id)?.modelName ?? t('admin.settings.fields.none');

  useEffect(() => {
    loadAdminData();
  }, []);

  // Every internal agent definition and the model it runs on.
  const renderInternalAgents = () => (
    <>
      <h1 className="t-page-title">{t('admin.agents.title')}</h1>
      <div className="page-title-bar" />
      <p className="admin-intro t-body-lg">{t('admin.agents.intro')}</p>

      {internalAgents === undefined ? (
        <div className="admin-empty t-ui-plain">{t('common.loading')}</div>
      ) : (
        <div className="admin-list">
          {internalAgents.map((agent) => (
            <button
              key={agent.id}
              className="admin-list-row"
              onClick={() => navigate(`/admin/agents/${agent.id}`)}
            >
              <div className="admin-row-main">
                <div className="admin-row-title t-table-strong">{agent.name}</div>
                <div className="admin-row-sub t-caption">{agent.description}</div>
              </div>
              <div className="admin-row-meta t-meta">
                {agent.modelId ? modelNameById(agent.modelId) : t('admin.agents.meta.notSet')}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );

  const renderContent = () => {
    if (tab === 'settings') {
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
    if (tab === 'agents') {
      return renderInternalAgents();
    }

    // Overview — each group is a bordered row list; clicking a row opens it in the main area
    return (
      <>
        <h1 className="t-page-title">{t('contextColumn.admin')}</h1>
        <div className="page-title-bar" />
        <p className="admin-intro t-body-lg">{t('admin.intro')}</p>

        <div className="admin-overview-group">
          <div className="t-overline">{t('admin.tabs.endpoints')}</div>
          {endpoints === undefined ? (
            <div className="admin-empty t-ui-plain">{t('common.loading')}</div>
          ) : (
            <div className="admin-list">
              {endpoints.length === 0 && (
                <div className="admin-list-empty t-ui-plain">{t('admin.endpoints.list.empty')}</div>
              )}
              {endpoints.map((endpoint) => (
                <button
                  key={endpoint.id}
                  className="admin-list-row"
                  onClick={() => navigate(`/admin/endpoints/${endpoint.id}`)}
                >
                  <div className="admin-row-main">
                    <div className="admin-row-title t-table-strong">{endpoint.url}</div>
                  </div>
                  <div className="admin-row-meta t-meta">{t(`admin.endpointType.${endpoint.endpointType}`)}</div>
                </button>
              ))}
              <button className="admin-list-add t-ui" onClick={() => navigate('/admin/endpoints/new')}>
                + {t('admin.endpoints.add.title')}
              </button>
            </div>
          )}
        </div>

        <div className="admin-overview-group">
          <div className="t-overline">{t('admin.tabs.models')}</div>
          {models === undefined ? (
            <div className="admin-empty t-ui-plain">{t('common.loading')}</div>
          ) : (
            <div className="admin-list">
              {models.length === 0 && (
                <div className="admin-list-empty t-ui-plain">{t('admin.models.list.empty')}</div>
              )}
              {models.map((model) => (
                <button
                  key={model.id}
                  className="admin-list-row"
                  onClick={() => navigate(`/admin/models/${model.id}`)}
                >
                  <div className="admin-row-main">
                    <div className="admin-row-title t-table-strong">{model.modelName}</div>
                    <div className="admin-row-sub t-caption">
                      {endpoints?.find(e => e.id === model.endpointId)?.url ?? ''}
                    </div>
                  </div>
                  <ClassificationBadge classification={model.classification} />
                  <div className="admin-row-meta t-meta">{model.modelId}</div>
                </button>
              ))}
              <button className="admin-list-add t-ui" onClick={() => navigate('/admin/models/new')}>
                + {t('admin.models.add.title')}
              </button>
            </div>
          )}
        </div>

        <div className="admin-overview-group">
          <div className="t-overline">{t('admin.tabs.assistants')}</div>
          {assistants === undefined ? (
            <div className="admin-empty t-ui-plain">{t('common.loading')}</div>
          ) : (
            <div className="admin-list">
              {assistants.length === 0 && (
                <div className="admin-list-empty t-ui-plain">{t('admin.assistants.list.empty')}</div>
              )}
              {assistants.map((assistant) => (
                <button
                  key={assistant.id}
                  className="admin-list-row"
                  onClick={() => navigate(`/admin/assistants/${assistant.id}`)}
                >
                  <div className="admin-row-main">
                    <div className="admin-row-title t-table-strong">{assistant.name}</div>
                    {assistant.description && (
                      <div className="admin-row-sub t-caption">{assistant.description}</div>
                    )}
                  </div>
                </button>
              ))}
              <button className="admin-list-add t-ui" onClick={() => navigate('/admin/assistants/new')}>
                + {t('admin.assistants.add.title')}
              </button>
            </div>
          )}
        </div>

        <div className="admin-overview-group">
          <div className="t-overline">{t('admin.tabs.tools')}</div>
          {tools === undefined ? (
            <div className="admin-empty t-ui-plain">{t('common.loading')}</div>
          ) : (
            <div className="admin-list">
              {tools.length === 0 && (
                <div className="admin-list-empty t-ui-plain">{t('admin.tools.list.empty')}</div>
              )}
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  className="admin-list-row"
                  onClick={() => navigate(`/admin/tools/${tool.id}`)}
                >
                  <div className="admin-row-main">
                    <div className="admin-row-title t-table-strong">{toolboxLabel(tool, tools)}</div>
                    <div className="admin-row-sub t-caption">{tool.description}</div>
                  </div>
                  <ClassificationBadge classification={tool.classification} />
                  <div className="admin-row-meta t-meta">
                    {!tool.policy.enabled
                      ? t('admin.tools.meta.disabled')
                      : tool.isOverridden ? t('admin.tools.meta.overridden') : t('admin.tools.meta.default')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="admin-overview-group">
          <div className="t-overline">{t('admin.tabs.settings')}</div>
          {settings === undefined ? (
            <div className="admin-empty t-ui-plain">{t('common.loading')}</div>
          ) : (
            <div className="admin-list">
              <button className="admin-list-row" onClick={() => navigate('/admin/settings')}>
                <div className="admin-row-main">
                  <div className="admin-row-title t-table-strong">{t('admin.settings.title')}</div>
                  <div className="admin-row-sub t-caption">
                    {t('admin.settings.fields.defaultModel')}: {modelNameById(settings.defaultModelId)}
                    {' · '}
                    {t('admin.settings.fields.chatNamingModel')}: {modelNameById(settings.chatNamingModelId)}
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </>
    );
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
