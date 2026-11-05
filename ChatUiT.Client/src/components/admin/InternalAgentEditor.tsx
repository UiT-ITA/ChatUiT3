import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { saveAdminInternalAgentSetting } from '../../services/adminService';
import { adminInternalAgentsSignal, adminLanguageModelsSignal, loadAdminData } from '../../services/adminDataService';
import { clampEffort } from '../../types/admin';
import type { ReasoningEffortLevel } from '../../types/admin';
import AgentFunctionRows from './AgentFunctionRows';
import EditorHeader from '../layout/EditorHeader';
import Select from '../common/Select';
import Checkbox from '../common/Checkbox';
import Field, { FieldDescription } from '../common/Field';
import Stack from '../common/Stack';
import { hasChanges } from '../../utils/formChanges';
import PageTitleBar from '../common/PageTitleBar';
import EmptyNote from '../common/EmptyNote';
import Text from '../common/Text';

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
  const models = adminLanguageModelsSignal.value;
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
    return <EmptyNote>{t('common.loading')}</EmptyNote>;
  }

  if (!agent) {
    return <EmptyNote>{t('common.notFound')}</EmptyNote>;
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

  // Compares the clamped effort a save would send with the stored effort
  const dirty = hasChanges(
    { modelId, reasoningEffort: models === undefined ? reasoningEffort : currentEffort, exposedInApi },
    { modelId: agent.modelId ?? '', reasoningEffort: agent.reasoningEffort ?? 'None', exposedInApi: agent.exposedInApi ?? false },
  );

  return (
    <>
      <EditorHeader
        backPath="/admin/agents"
        backLabel={t('admin.tabs.agents')}
        dirty={dirty}
        saveLabel={saving ? t('assistants.saving') : t('common.save')}
        saveDisabled={!canSave}
        onSave={handleSave}
        onCancel={() => navigate('/admin/agents')}
      />
      <Text as="h1" variant="page-title">{agent.name}</Text>
      <PageTitleBar />

      <Stack gap="xl">
        <Field label={t('admin.agents.fields.id')}>
          <Text as="div" variant="code">{agent.id}</Text>
        </Field>

        <Field label={t('admin.agents.fields.description')}>
          <Text as="div" variant="body">{agent.description}</Text>
        </Field>

        {agent.functions.length > 0 && (
          <Field label={t('admin.agents.fields.functions')} description={t('admin.agents.fields.functionsHelp')}>
            <AgentFunctionRows functions={agent.functions} />
          </Field>
        )}

        <Select
          label={t('admin.agents.fields.model')}
          description={agent.modelId ? t('admin.agents.fields.modelHelp') : t('admin.agents.fields.notSetHelp')}
          value={modelId}
          onChange={setModelId}
          disabled={saving}
        >
          <option value="">{t('admin.agents.fields.chooseModel')}</option>
          {modelOptions.map(model => (
            <option key={model.id} value={model.id}>
              {model.modelName} ({model.modelId})
            </option>
          ))}
        </Select>

        {supportedEfforts.length > 0 && (
          <Select
            label={t('admin.agents.fields.reasoningEffort')}
            description={t('admin.agents.fields.reasoningEffortHelp')}
            value={currentEffort}
            onChange={(value) => setReasoningEffort(value as ReasoningEffortLevel)}
            disabled={saving || supportedEfforts.length === 1}
          >
            {supportedEfforts.map(level => (
              <option key={level} value={level}>
                {t(`assistants.form.reasoningLevels.${level.toLowerCase()}`)}
              </option>
            ))}
          </Select>
        )}

        <Checkbox
          checked={exposedInApi}
          onChange={setExposedInApi}
          disabled={saving}
          description={t('admin.agents.fields.exposedInApiHelp', { id: agent.id })}
        >
          {t('admin.agents.fields.exposedInApi')}
        </Checkbox>

        {agent.updatedAt && (
          <FieldDescription>
            {t('admin.agents.fields.updated', { date: new Date(agent.updatedAt).toLocaleString() })}
          </FieldDescription>
        )}
      </Stack>
    </>
  );
};

export default InternalAgentEditor;
