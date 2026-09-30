import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { updateAdminToolPolicy, resetAdminToolPolicy } from '../../services/adminService';
import { adminToolsSignal, loadAdminData } from '../../services/adminDataService';
import { refreshTools } from '../../services/toolService';
import type { UserRole, AdminToolDto, ToolAccessPolicyDto } from '../../types/admin';
import GroupPicker from '../common/GroupPicker';
import AgentFunctionRows from './AgentFunctionRows';

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
    return <div className="admin-empty t-ui-plain">{t('common.loading')}</div>;
  }

  if (!tool) {
    return <div className="admin-empty t-ui-plain">{t('common.notFound')}</div>;
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
    navigate('/admin');
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
    if (!window.confirm(t('admin.tools.actions.resetConfirm'))) return;
    setSaving(true);
    try {
      await resetAdminToolPolicy(tool.id);
      await finish();
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

  return (
    <div className="admin-form admin-form-wide">
      <h1 className="t-page-title">{tool.name}</h1>
      <div className="page-title-bar" />

      <div className="admin-field">
        <div className="admin-label t-label">{t('admin.tools.fields.id')}</div>
        <div className="t-code">{tool.id}</div>
      </div>

      <div className="admin-field">
        <div className="admin-label t-label">{t('admin.tools.fields.description')}</div>
        <div className="t-body">{tool.description}</div>
      </div>

      <div className="admin-field">
        <div className="admin-label t-label">{t('admin.tools.fields.requiresConfirmation')}</div>
        <div className="t-body">{tool.requiresConfirmation ? t('common.yes', { defaultValue: 'Yes' }) : t('common.no', { defaultValue: 'No' })}</div>
      </div>

      {tool.requiredScopes.length > 0 && (
        <div className="admin-field">
          <div className="admin-label t-label">{t('admin.tools.fields.requiredScopes')}</div>
          <div className="t-code">{tool.requiredScopes.join(', ')}</div>
        </div>
      )}

      {tool.functions && tool.functions.length > 0 && (
        <div className="admin-field">
          <div className="admin-label t-label">{t('admin.tools.fields.functions')}</div>
          <div className="admin-field-help t-caption">{t('admin.tools.fields.functionsHelp')}</div>
          <AgentFunctionRows functions={tool.functions} />
        </div>
      )}

      {tool.parametersSchema && (
        <div className="admin-field">
          <div className="admin-label t-label">{t('admin.tools.fields.schema')}</div>
          <pre className="toolcall-pre t-code" style={{ maxHeight: '16rem', overflow: 'auto' }}>
            {JSON.stringify(tool.parametersSchema, null, 2)}
          </pre>
        </div>
      )}

      <div className="admin-field" style={{ marginTop: '1.375rem' }}>
        <div className="admin-label t-label">{t('admin.tools.fields.defaultPolicy')}</div>
        <div className="t-body">{describePolicy(tool.defaultPolicy)}</div>
        <div className="admin-field-help t-caption">
          {tool.isOverridden
            ? t('admin.tools.fields.overridden', { date: tool.updatedAt ? new Date(tool.updatedAt).toLocaleString() : '' })
            : t('admin.tools.fields.usingDefault')}
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-checkbox-label t-body">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          {t('admin.tools.fields.enabled')}
        </label>
        <div className="admin-field-help t-caption">{t('admin.tools.fields.enabledHelp')}</div>
      </div>

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.tools.fields.allowedRoles')}</label>
        <div className="admin-checkbox-group">
          {ALL_ROLES.map(role => (
            <label key={role} className="admin-checkbox-label t-body">
              <input
                type="checkbox"
                checked={allowedRoles.includes(role)}
                onChange={e => toggleRole(role, e.target.checked)}
              />
              {t(`roles.${role}`)}
            </label>
          ))}
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.tools.fields.allowedGroups')}</label>
        <div className="admin-field-help t-caption">{t('admin.tools.fields.allowedGroupsHelp')}</div>
        <GroupPicker value={allowedGroupIds} onChange={setAllowedGroupIds} disabled={saving} />
      </div>

      {nobody && (
        <div className="admin-field-help t-caption" style={{ color: 'var(--warn)' }}>{t('admin.tools.fields.nobodyWarning')}</div>
      )}

      <div className="admin-form-footer">
        <button className="admin-save-button t-ui" onClick={handleSave} disabled={saving}>
          {saving ? t('assistants.saving') : t('common.save')}
        </button>
        <button className="admin-cancel-button t-ui" onClick={() => navigate('/admin')}>
          {t('common.cancel')}
        </button>
        {tool.isOverridden && (
          <>
            <div className="admin-footer-spacer" />
            <button className="admin-delete-button t-ui" onClick={handleReset} disabled={saving}>
              {t('admin.tools.actions.reset')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ToolEditor;
