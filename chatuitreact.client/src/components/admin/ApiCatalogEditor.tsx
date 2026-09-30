import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { saveAdminApiCatalogEntry, deleteAdminApiCatalogEntry } from '../../services/adminService';
import { adminApiCatalogSignal, adminInternalAgentsSignal, loadAdminData } from '../../services/adminDataService';
import { API_PUBLIC_ID_PATTERN } from '../../types/admin';
import type { UserRole, ApiCatalogEntryDto, ToolAccessPolicyDto } from '../../types/admin';
import GroupPicker from '../common/GroupPicker';

const ALL_ROLES: UserRole[] = ['User', 'Admin', 'Beta', 'Super', 'External'];

interface ApiCatalogEditorProps {
  /** An agent id or a model entry's public id; undefined exposes a new model. */
  publicId?: string;
}

interface FormState {
  publicId: string;
  enabled: boolean;
  allowedRoles: UserRole[];
  allowedGroupIds: string[];
  /** Models only: the model exposed. */
  modelId: string;
}

function formStateFor(publicId: string | undefined, entry: ApiCatalogEntryDto | undefined): FormState {
  return {
    publicId: publicId ?? '',
    // Entries start disabled.
    enabled: entry?.enabled ?? false,
    allowedRoles: [...(entry?.allowedRoles ?? [])],
    allowedGroupIds: [...(entry?.allowedGroupIds ?? [])],
    modelId: entry?.kind === 'model' ? entry.targetId : '',
  };
}


/**
 * Edits one Responses API catalog entry: whether an agent or a model is exposed, and to whom.
 * Agents are code and always listed; saving one for the first time creates its entry. An
 * agent's model is set under Internal agents and only shown here.
 */
const ApiCatalogEditor: React.FC<ApiCatalogEditorProps> = ({ publicId }) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const catalog = adminApiCatalogSignal.value;
  const internalAgents = adminInternalAgentsSignal.value;
  const agent = publicId ? catalog?.agents.find(candidate => candidate.id === publicId) : undefined;
  const entry = publicId ? catalog?.entries.find(candidate => candidate.publicId === publicId) : undefined;
  const isNew = publicId === undefined;

  const initial = formStateFor(publicId, entry);
  const [form, setForm] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const [synced, setSynced] = useState(entry);
  if (entry !== synced) {
    setSynced(entry);
    setForm(formStateFor(publicId, entry));
  }

  if (catalog === undefined) {
    return <div className="admin-empty t-ui-plain">{t('common.loading')}</div>;
  }

  if (!isNew && !agent && entry?.kind !== 'model') {
    return <div className="admin-empty t-ui-plain">{t('common.notFound')}</div>;
  }

  const update = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const toggleRole = (role: UserRole, checked: boolean) => {
    setForm(prev => {
      const set = new Set(prev.allowedRoles);
      if (checked) set.add(role);
      else set.delete(role);
      return { ...prev, allowedRoles: ALL_ROLES.filter(candidate => set.has(candidate)) };
    });
  };

  const configuredModelId = agent ? internalAgents?.find(candidate => candidate.id === agent.id)?.modelId : undefined;
  const configuredModel = catalog.models.find(model => model.id === configuredModelId);
  const publicIdValid = !isNew || API_PUBLIC_ID_PATTERN.test(form.publicId);
  const canSave = !saving && publicIdValid && (agent !== undefined || form.modelId !== '');
  const nobody = form.enabled && form.allowedRoles.length === 0 && form.allowedGroupIds.length === 0;

  const finish = async () => {
    await loadAdminData(true);
    navigate('/admin/api');
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await saveAdminApiCatalogEntry(form.publicId, {
        kind: agent ? 'agent' : 'model',
        targetId: agent ? agent.id : form.modelId,
        enabled: form.enabled,
        allowedRoles: form.allowedRoles,
        allowedGroupIds: form.allowedGroupIds,
      });
      await finish();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (saving || !entry) return;
    if (!window.confirm(t('admin.api.actions.deleteConfirm'))) return;
    setSaving(true);
    try {
      await deleteAdminApiCatalogEntry(entry.publicId);
      await finish();
    } finally {
      setSaving(false);
    }
  };

  const describePolicy = (policy: ToolAccessPolicyDto) => {
    const parts: string[] = [];
    if (!policy.enabled) parts.push(t('admin.api.meta.disabled'));
    if (policy.allowedRoles.length > 0) parts.push(policy.allowedRoles.map(role => t(`roles.${role}`)).join(', '));
    if (policy.allowedGroupIds.length > 0) parts.push(`${policy.allowedGroupIds.length} ${t('admin.tools.fields.allowedGroups').toLowerCase()}`);
    return parts.join(' · ') || '—';
  };

  return (
    <div className="admin-form admin-form-wide">
      <h1 className="t-page-title">{agent ? agent.name : isNew ? t('admin.api.add.title') : form.publicId}</h1>
      <div className="page-title-bar" />

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.api.fields.publicId')}</label>
        {isNew ? (
          <>
            <input
              className="admin-input t-body"
              value={form.publicId}
              onChange={e => update({ publicId: e.target.value.trim() })}
              placeholder="gpt-5.4"
            />
            <div className="admin-field-help t-caption" style={publicIdValid || form.publicId === '' ? undefined : { color: 'var(--warn)' }}>
              {publicIdValid || form.publicId === '' ? t('admin.api.fields.publicIdHelp') : t('admin.api.fields.publicIdInvalid')}
            </div>
          </>
        ) : (
          <div className="t-code">{form.publicId}</div>
        )}
      </div>

      {agent && (
        <>
          <div className="admin-field">
            <div className="admin-label t-label">{t('admin.api.fields.description')}</div>
            <div className="t-body">{agent.description}</div>
          </div>

          {agent.toolIds.length > 0 && (
            <div className="admin-field">
              <div className="admin-label t-label">{t('admin.api.fields.tools')}</div>
              <div className="t-code">{agent.toolIds.join(', ')}</div>
            </div>
          )}

          <div className="admin-field">
            <div className="admin-label t-label">{t('admin.api.fields.agentDefault')}</div>
            <div className="t-body">{describePolicy(agent.defaultPolicy)}</div>
          </div>

          <div className="admin-field">
            <div className="admin-label t-label">{t('admin.api.fields.agentModel')}</div>
            <div className="t-body">
              {configuredModel ? `${configuredModel.modelName} (${configuredModel.modelId})` : configuredModelId ?? t('admin.api.fields.agentModelNotSet')}
            </div>
            <div className="admin-field-help t-caption">{t('admin.api.fields.agentModelHelp')}</div>
          </div>
        </>
      )}

      {!agent && (
        <div className="admin-field">
          <label className="admin-label t-label">{t('admin.api.fields.targetModel')}</label>
          <select
            className="admin-select t-body"
            value={form.modelId}
            onChange={e => update({ modelId: e.target.value })}
            disabled={!isNew}
          >
            <option value="">{t('admin.api.fields.chooseModel')}</option>
            {catalog.models.map(model => (
              <option key={model.id} value={model.id}>
                {model.modelName} ({model.modelId})
              </option>
            ))}
          </select>
          <div className="admin-field-help t-caption">{t('admin.api.fields.targetModelHelp')}</div>
        </div>
      )}

      <div className="admin-field" style={{ marginTop: '1.375rem' }}>
        <label className="admin-checkbox-label t-body">
          <input type="checkbox" checked={form.enabled} onChange={e => update({ enabled: e.target.checked })} />
          {t('admin.api.fields.enabled')}
        </label>
        <div className="admin-field-help t-caption">{t('admin.api.fields.enabledHelp')}</div>
      </div>

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.tools.fields.allowedRoles')}</label>
        <div className="admin-checkbox-group">
          {ALL_ROLES.map(role => (
            <label key={role} className="admin-checkbox-label t-body">
              <input
                type="checkbox"
                checked={form.allowedRoles.includes(role)}
                onChange={e => toggleRole(role, e.target.checked)}
              />
              {t(`roles.${role}`)}
            </label>
          ))}
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.tools.fields.allowedGroups')}</label>
        <GroupPicker value={form.allowedGroupIds} onChange={ids => update({ allowedGroupIds: ids })} disabled={saving} />
      </div>

      {nobody && (
        <div className="admin-field-help t-caption" style={{ color: 'var(--warn)' }}>{t('admin.api.fields.nobodyWarning')}</div>
      )}

      {entry?.updatedAt && (
        <div className="admin-field-help t-caption">
          {t('admin.api.fields.updated', { date: new Date(entry.updatedAt).toLocaleString() })}
        </div>
      )}

      <div className="admin-form-footer">
        <button className="admin-save-button t-ui" onClick={handleSave} disabled={!canSave}>
          {saving ? t('assistants.saving') : t('common.save')}
        </button>
        <button className="admin-cancel-button t-ui" onClick={() => navigate('/admin/api')}>
          {t('common.cancel')}
        </button>
        {entry && (
          <>
            <div className="admin-footer-spacer" />
            <button className="admin-delete-button t-ui" onClick={handleDelete} disabled={saving}>
              {t('admin.api.actions.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ApiCatalogEditor;
