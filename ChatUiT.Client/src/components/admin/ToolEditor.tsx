import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { updateAdminToolPolicy, resetAdminToolPolicy, searchAdminGroups, resolveAdminGroups } from '../../services/adminService';
import { adminToolsSignal, loadAdminData } from '../../services/adminDataService';
import { refreshTools } from '../../services/toolService';
import { toolboxLabel, type UserRole, type AdminToolDto, type ToolAccessPolicyDto } from '../../types/admin';
import GroupPicker from '../common/GroupPicker';
import EditorHeader from '../layout/EditorHeader';
import { ConfirmDialog } from '../common/Dialog';
import { hasChanges } from '../../utils/formChanges';
import AgentFunctionRows from './AgentFunctionRows';
import ClassificationBadge from '../classification/ClassificationBadge';
import Checkbox, { CheckboxGroup } from '../common/Checkbox';
import Field, { FieldDescription } from '../common/Field';
import Stack from '../common/Stack';
import Button from '../common/Button';
import PageTitleBar from '../common/PageTitleBar';
import Text from '../common/Text';
import TextBlock from '../common/TextBlock';
import EmptyNote from '../common/EmptyNote';
import FormFooter from '../common/FormFooter';

const ALL_ROLES: UserRole[] = ['User', 'Admin', 'Beta', 'Super', 'External'];

interface ToolEditorProps {
  toolId: string;
}

function formStateFor(tool: AdminToolDto | undefined): ToolAccessPolicyDto {
  return {
    enabled: tool?.policy.enabled ?? true,
    allowedRoles: [...(tool?.policy.allowedRoles ?? [])],
    allowedGroupIds: [...(tool?.policy.allowedGroupIds ?? [])],
  };
}

/**
 * Edits who may use one tool. The tool itself is code and shown read-only; the policy saved
 * here overrides the code default until it is reset.
 */
const ToolEditor: React.FC<ToolEditorProps> = ({ toolId }) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tools = adminToolsSignal.value;
  const tool = tools?.find(candidate => candidate.id === toolId);

  const initial = formStateFor(tool);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>(initial.allowedRoles);
  const [allowedGroupIds, setAllowedGroupIds] = useState<string[]>(initial.allowedGroupIds);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [shownToolId, setShownToolId] = useState(toolId);
  if (toolId !== shownToolId) {
    setShownToolId(toolId);
    setConfirmReset(false);
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  const [synced, setSynced] = useState(tool);
  if (tool !== synced) {
    setSynced(tool);
    const next = formStateFor(tool);
    setEnabled(next.enabled);
    setAllowedRoles(next.allowedRoles);
    setAllowedGroupIds(next.allowedGroupIds);
  }

  if (tools === undefined) {
    return <EmptyNote>{t('common.loading')}</EmptyNote>;
  }

  if (!tool) {
    return <EmptyNote>{t('common.notFound')}</EmptyNote>;
  }

  const toggleRole = (role: UserRole, checked: boolean) => {
    setAllowedRoles(prev => {
      const set = new Set(prev);
      if (checked) set.add(role);
      else set.delete(role);
      return ALL_ROLES.filter(candidate => set.has(candidate));
    });
  };

  const nobody = enabled && allowedRoles.length === 0 && allowedGroupIds.length === 0;

  const finish = async () => {
    await loadAdminData(true);
    await refreshTools();
    navigate('/admin/tools');
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateAdminToolPolicy(tool.id, { enabled, allowedRoles, allowedGroupIds });
      await finish();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (saving || !tool.isOverridden) return;
    setSaving(true);
    try {
      await resetAdminToolPolicy(tool.id);
      await finish();
    } catch (error) {
      console.error('Failed to reset tool policy:', error);
    } finally {
      setSaving(false);
    }
  };

  const describePolicy = (policy: ToolAccessPolicyDto) => {
    const parts: string[] = [];
    if (!policy.enabled) parts.push(t('admin.tools.meta.disabled'));
    if (policy.allowedRoles.length > 0) parts.push(policy.allowedRoles.map(role => t(`roles.${role}`)).join(', '));
    if (policy.allowedGroupIds.length > 0) parts.push(`${policy.allowedGroupIds.length} ${t('admin.tools.fields.allowedGroups').toLowerCase()}`);
    return parts.join(' · ') || '—';
  };

  const dirty = hasChanges({ enabled, allowedRoles, allowedGroupIds }, initial);

  return (
    <>
      <EditorHeader
        backPath="/admin/tools"
        backLabel={t('admin.tabs.tools')}
        dirty={dirty}
        saveLabel={saving ? t('assistants.saving') : t('common.save')}
        saveDisabled={saving}
        onSave={handleSave}
        onCancel={() => navigate('/admin/tools')}
      />
      <Text as="h1" variant="page-title">{toolboxLabel(tool, tools)}</Text>
      <PageTitleBar />

      <Stack gap="xl">
        <Field label={t('admin.tools.fields.id')}>
          <Text as="div" variant="code">{tool.id}</Text>
        </Field>

        <Field label={t('admin.tools.fields.description')}>
          <Text as="div" variant="body">{tool.description}</Text>
        </Field>

        <Field label={t('admin.models.fields.classification')}>
          <div><ClassificationBadge classification={tool.classification} /></div>
        </Field>

        <Field label={t('admin.tools.fields.requiresConfirmation')}>
          <Text as="div" variant="body">{tool.requiresConfirmation ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })}</Text>
        </Field>

        {tool.requiredScopes.length > 0 && (
          <Field label={t('admin.tools.fields.requiredScopes')}>
            <Text as="div" variant="code">{tool.requiredScopes.join(', ')}</Text>
          </Field>
        )}

        {tool.functions && tool.functions.length > 0 && (
          <Field label={t('admin.tools.fields.functions')} description={t('admin.tools.fields.functionsHelp')}>
            <AgentFunctionRows functions={tool.functions} showClassification />
          </Field>
        )}

        {tool.parametersSchema && (
          <Field label={t('admin.tools.fields.schema')}>
            <TextBlock monospace>{JSON.stringify(tool.parametersSchema, null, 2)}</TextBlock>
          </Field>
        )}

        <Field
          label={t('admin.tools.fields.defaultPolicy')}
          description={tool.isOverridden
            ? t('admin.tools.fields.overridden', { date: tool.updatedAt ? new Date(tool.updatedAt).toLocaleString() : '' })
            : t('admin.tools.fields.usingDefault')}
        >
          <Text as="div" variant="body">{describePolicy(tool.defaultPolicy)}</Text>
        </Field>

        <Checkbox checked={enabled} onChange={setEnabled} description={t('admin.tools.fields.enabledHelp')}>
          {t('admin.tools.fields.enabled')}
        </Checkbox>

        <Field label={t('admin.tools.fields.allowedRoles')}>
          <CheckboxGroup>
            {ALL_ROLES.map(role => (
              <Checkbox
                key={role}
                checked={allowedRoles.includes(role)}
                onChange={checked => toggleRole(role, checked)}
              >
                {t(`roles.${role}`)}
              </Checkbox>
            ))}
          </CheckboxGroup>
        </Field>

        <Field label={t('admin.tools.fields.allowedGroups')} description={t('admin.tools.fields.allowedGroupsHelp')}>
          <GroupPicker value={allowedGroupIds} onChange={setAllowedGroupIds} search={searchAdminGroups} resolve={resolveAdminGroups} disabled={saving} />
        </Field>

        {nobody && (
          <FieldDescription tone="warning">{t('admin.tools.fields.nobodyWarning')}</FieldDescription>
        )}
      </Stack>

      {tool.isOverridden && (
        <FormFooter>
          <Button variant="danger" ml="auto" onClick={() => setConfirmReset(true)} disabled={saving}>
            {t('admin.tools.actions.reset')}
          </Button>
        </FormFooter>
      )}

      <ConfirmDialog
        isOpen={confirmReset}
        title={t('admin.tools.actions.reset')}
        message={t('admin.tools.actions.resetConfirm')}
        confirmLabel={t('admin.tools.actions.reset')}
        busy={saving}
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  );
};

export default ToolEditor;
