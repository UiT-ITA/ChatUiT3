import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { saveAdminInternalAgentSetting } from '../../services/adminService';
import { adminInternalAgentsSignal, adminModelsSignal, loadAdminData } from '../../services/adminDataService';
import { clampEffort } from '../../types/admin';
import type { ReasoningEffortLevel } from '../../types/admin';
import AgentFunctionRows from './AgentFunctionRows';
import EditorHeader from '../layout/EditorHeader';

interface InternalAgentEditorProps {
  agentId: string;
}

/**
 * Sets the model and reasoning level one internal agent runs on. The agent itself is code and
 * shown read-only. The setting applies to every run of the agent: in chats and in the API.
 */
const InternalAgentEditor: React.FC<InternalAgentEditorProps> = ({ agentId }) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const agents = adminInternalAgentsSignal.value;
  const models = adminModelsSignal.value;
  const agent = agents?.find(candidate => candidate.id === agentId);

  const [modelId, setModelId] = useState(agent?.modelId ?? '');
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortLevel>(agent?.reasoningEffort ?? 'None');
  const [exposedInApi, setExposedInApi] = useState(agent?.exposedInApi ?? false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const [synced, setSynced] = useState(agent);
  if (agent !== synced) {
    setSynced(agent);
    setModelId(agent?.modelId ?? '');
    setReasoningEffort(agent?.reasoningEffort ?? 'None');
    setExposedInApi(agent?.exposedInApi ?? false);
  }

  if (agents === undefined) {
    return <div className="admin-empty t-ui-plain">{t('common.loading')}</div>;
  }

  if (!agent) {
    return <div className="admin-empty t-ui-plain">{t('common.notFound')}</div>;
  }

  const modelOptions = (models ?? []).filter(model => model.capabilities.supportsFunctionCalling);
  const supportedEfforts = modelOptions.find(model => model.id === modelId)?.capabilities.supportedEfforts ?? [];
  const currentEffort = clampEffort(reasoningEffort, supportedEfforts);
  const canSave = !saving && modelId !== '';

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await saveAdminInternalAgentSetting(agent.id, { modelId, reasoningEffort: currentEffort, exposedInApi });
      await loadAdminData(true);
      navigate('/admin/agents');
    } finally {
      setSaving(false);
    }
  };

  const dirty = modelId !== (agent.modelId ?? '') || reasoningEffort !== (agent.reasoningEffort ?? 'None') || exposedInApi !== (agent.exposedInApi ?? false);

  return (
    <div className="admin-form admin-form-wide">
      <EditorHeader
        backPath="/admin/agents"
        backLabel={t('admin.tabs.agents')}
        dirty={dirty}
        saveLabel={saving ? t('assistants.saving') : t('common.save')}
        saveDisabled={!canSave}
        onSave={handleSave}
        onCancel={() => navigate('/admin/agents')}
      />
      <h1 className="t-page-title">{agent.name}</h1>
      <div className="page-title-bar" />

      <div className="admin-field">
        <div className="admin-label t-label">{t('admin.agents.fields.id')}</div>
        <div className="t-code">{agent.id}</div>
      </div>

      <div className="admin-field">
        <div className="admin-label t-label">{t('admin.agents.fields.description')}</div>
        <div className="t-body">{agent.description}</div>
      </div>

      {agent.functions.length > 0 && (
        <div className="admin-field">
          <div className="admin-label t-label">{t('admin.agents.fields.functions')}</div>
          <div className="admin-field-help t-caption">{t('admin.agents.fields.functionsHelp')}</div>
          <AgentFunctionRows functions={agent.functions} />
        </div>
      )}

      <div className="admin-field" style={{ marginTop: '1.375rem' }}>
        <label className="admin-label t-label">{t('admin.agents.fields.model')}</label>
        <select
          className="admin-select t-body"
          value={modelId}
          onChange={e => setModelId(e.target.value)}
          disabled={saving}
        >
          <option value="">{t('admin.agents.fields.chooseModel')}</option>
          {modelOptions.map(model => (
            <option key={model.id} value={model.id}>
              {model.modelName} ({model.modelId})
            </option>
          ))}
        </select>
        <div className="admin-field-help t-caption">
          {agent.modelId ? t('admin.agents.fields.modelHelp') : t('admin.agents.fields.notSetHelp')}
        </div>
      </div>

      {supportedEfforts.length > 0 && (
        <div className="admin-field">
          <label className="admin-label t-label">{t('admin.agents.fields.reasoningEffort')}</label>
          <select
            className="admin-select t-body"
            value={currentEffort}
            onChange={e => setReasoningEffort(e.target.value as ReasoningEffortLevel)}
            disabled={saving || supportedEfforts.length === 1}
          >
            {supportedEfforts.map(level => (
              <option key={level} value={level}>
                {t(`assistants.form.reasoningLevels.${level.toLowerCase()}`)}
              </option>
            ))}
          </select>
          <div className="admin-field-help t-caption">{t('admin.agents.fields.reasoningEffortHelp')}</div>
        </div>
      )}

      <div className="admin-field">
        <label className="admin-checkbox-label t-table">
          <input
            type="checkbox"
            checked={exposedInApi}
            onChange={e => setExposedInApi(e.target.checked)}
            disabled={saving}
          />
          {t('admin.agents.fields.exposedInApi')}
        </label>
        <div className="admin-field-help t-caption">{t('admin.agents.fields.exposedInApiHelp', { id: agent.id })}</div>
      </div>

      {agent.updatedAt && (
        <div className="admin-field-help t-caption">
          {t('admin.agents.fields.updated', { date: new Date(agent.updatedAt).toLocaleString() })}
        </div>
      )}

    </div>
  );
};

export default InternalAgentEditor;
