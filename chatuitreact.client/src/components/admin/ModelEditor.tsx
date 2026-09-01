import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { createModel, updateModel, deleteModel, getModelCatalog } from '../../services/adminService';
import { adminEndpointsSignal, adminModelsSignal, loadAdminData } from '../../services/adminDataService';
import type {
  UserRole,
  ModelCapabilities,
  TemperatureSupport,
  ReasoningEffortLevel,
  CatalogModelDto,
} from '../../types/admin';
import { REASONING_EFFORT_ORDER } from '../../types/admin';

const ALL_ROLES: UserRole[] = ['User', 'Admin', 'Beta', 'Super', 'External'];

const TEMPERATURE_OPTIONS: TemperatureSupport[] = [
  'Unsupported',
  'Supported',
  'SupportedWhenReasoningDisabled',
];

const defaultCapabilities: ModelCapabilities = {
  supportsVision: false,
  supportsFunctionCalling: false,
  temperature: 'Unsupported',
  supportedEfforts: [],
  maxContextTokens: 16000,
  maxOutputTokens: 16000,
  defaultMaxOutputTokens: 16000,
  knowledgeCutoff: null,
};

interface ModelEditorProps {
  modelId?: string;
}

const ModelEditor: React.FC<ModelEditorProps> = ({ modelId: editId }) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const models = adminModelsSignal.value;
  const endpoints = adminEndpointsSignal.value ?? [];
  const model = editId ? models?.find(m => m.id === editId) : undefined;

  const [modelId, setModelId] = useState('');
  const [modelName, setModelName] = useState('');
  const [description, setDescription] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>([]);
  const [allowedAsDefault, setAllowedAsDefault] = useState(false);
  const [capabilities, setCapabilities] = useState<ModelCapabilities>(defaultCapabilities);
  const [knowledgeCutoffMonth, setKnowledgeCutoffMonth] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<CatalogModelDto[]>([]);

  useEffect(() => {
    loadAdminData();
    // A failed catalog fetch must not block the form — it only prefills.
    getModelCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    setModelId(model?.modelId ?? '');
    setModelName(model?.modelName ?? '');
    setDescription(model?.description ?? '');
    setEndpointId(model?.endpointId ?? (endpoints[0]?.id ?? ''));
    // A new model is available to everyone; an existing one keeps exactly the roles
    // it was saved with, so opening the form can never widen access on its own.
    setAllowedRoles(model ? (model.allowedRoles ?? []) : [...ALL_ROLES]);
    // A new model starts ticked; an admin unticks it for models too expensive to run unprompted.
    setAllowedAsDefault(model?.allowedAsDefault ?? true);
    const caps = model?.capabilities ?? defaultCapabilities;
    setCapabilities(caps);
    const iso = caps.knowledgeCutoff;
    setKnowledgeCutoffMonth(typeof iso === 'string' && iso.length >= 7 ? iso.slice(0, 7) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, endpoints.length]);

  if (editId && models === undefined) {
    return <div className="admin-empty t-ui-plain">{t('common.loading')}</div>;
  }

  if (editId && models !== undefined && !model) {
    return <div className="admin-empty t-ui-plain">{t('common.notFound')}</div>;
  }

  const toggleRole = (role: UserRole, checked: boolean) => {
    setAllowedRoles(prev => {
      const set = new Set(prev);
      if (checked) set.add(role);
      else set.delete(role);
      return Array.from(set) as UserRole[];
    });
  };

  const updateCaps = <K extends keyof ModelCapabilities>(key: K, value: ModelCapabilities[K]) => {
    setCapabilities(prev => ({ ...prev, [key]: value }));
  };

  // Kept in the canonical ascending order so the assistant form's slider and the server's
  // clamping both see the same ladder without re-sorting.
  const toggleEffort = (level: ReasoningEffortLevel, checked: boolean) => {
    setCapabilities(prev => {
      const next = new Set(prev.supportedEfforts);
      if (checked) next.add(level);
      else next.delete(level);
      return {
        ...prev,
        supportedEfforts: REASONING_EFFORT_ORDER.filter(l => next.has(l)),
      };
    });
  };

  // Prefill from a known model. Everything stays editable afterwards, so an admin can still
  // register a preview or self-hosted model the catalog has never heard of.
  const applyCatalogEntry = (entry: CatalogModelDto) => {
    setModelId(entry.modelId);
    setCapabilities(entry.capabilities);
    const cutoff = entry.capabilities.knowledgeCutoff;
    setKnowledgeCutoffMonth(typeof cutoff === 'string' && cutoff.length >= 7 ? cutoff.slice(0, 7) : '');
    if (!modelName) setModelName(entry.displayName);
    if (!description) setDescription(entry.description);
  };

  const canSave =
    !!modelId &&
    !!modelName &&
    !!description &&
    !!endpointId &&
    // AllowedRoles is now enforced, so a model saved with no roles would be invisible to
    // everyone with nothing to explain why.
    allowedRoles.length > 0 &&
    Number(capabilities.maxContextTokens) > 0 &&
    Number(capabilities.maxOutputTokens) > 0 &&
    Number(capabilities.defaultMaxOutputTokens) > 0 &&
    Number(capabilities.defaultMaxOutputTokens) <= Number(capabilities.maxOutputTokens);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const capsToSend: ModelCapabilities = {
        ...capabilities,
        knowledgeCutoff: knowledgeCutoffMonth ? `${knowledgeCutoffMonth}-01T00:00:00Z` : null,
      };
      const payload = { modelId, modelName, description, endpointId, allowedRoles, allowedAsDefault, capabilities: capsToSend };

      if (model) {
        await updateModel(model.id, { id: model.id, ...payload });
      } else {
        await createModel(payload);
      }
      await loadAdminData(true);
      navigate('/admin');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!model) return;
    if (!window.confirm(t('admin.models.dialog.delete.confirm'))) return;
    await deleteModel(model.id);
    await loadAdminData(true);
    navigate('/admin');
  };

  return (
    <div className="admin-form admin-form-wide">
      <h1 className="t-page-title">
        {model ? t('admin.models.dialog.edit.title') : t('admin.models.add.title')}
      </h1>
      <div className="page-title-bar" />

      {catalog.length > 0 && (
        <div className="admin-field">
          <label className="admin-label t-label">{t('admin.models.fields.knownModel')}</label>
          <select
            className="admin-select t-body"
            value={catalog.some(c => c.modelId === modelId) ? modelId : ''}
            onChange={(e) => {
              const entry = catalog.find(c => c.modelId === e.target.value);
              if (entry) applyCatalogEntry(entry);
            }}
          >
            <option value="">{t('admin.models.fields.knownModelCustom')}</option>
            {catalog.map(entry => (
              <option key={entry.modelId} value={entry.modelId}>
                {entry.displayName} ({t(`admin.endpointType.${entry.provider}`)})
              </option>
            ))}
          </select>
          <div className="af-note t-ui-plain">{t('admin.models.fields.knownModelHint')}</div>
        </div>
      )}

      <div className="admin-field-grid">
        <div className="admin-field">
          <label className="admin-label t-label">{t('admin.models.fields.modelId')}</label>
          <input
            className="admin-input t-body"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="gpt-5.4, claude-opus-5 …"
          />
        </div>
        <div className="admin-field">
          <label className="admin-label t-label">{t('admin.models.fields.modelName')}</label>
          <input
            className="admin-input t-body"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
          />
        </div>
      </div>

      <div className="admin-field" style={{ marginTop: '1.375rem' }}>
        <label className="admin-label t-label">{t('admin.models.fields.description')}</label>
        <textarea
          className="admin-textarea t-body"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.models.fields.endpoint')}</label>
        <select
          className="admin-select t-body"
          value={endpointId}
          onChange={(e) => setEndpointId(e.target.value)}
        >
          {endpoints.map(ep => (
            <option key={ep.id} value={ep.id}>{ep.url}</option>
          ))}
        </select>
      </div>

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.models.fields.allowedRoles')}</label>
        <div className="admin-checkbox-group">
          {ALL_ROLES.map(role => (
            <label key={role} className="admin-checkbox-label t-table">
              <input
                type="checkbox"
                checked={allowedRoles.includes(role)}
                onChange={(e) => toggleRole(role, e.target.checked)}
              />
              {t(`roles.${role}`)}
            </label>
          ))}
        </div>
        {allowedRoles.length === 0 && (
          <div className="af-note t-ui-plain">{t('admin.models.fields.allowedRolesRequired')}</div>
        )}
      </div>

      <div className="admin-field">
        <label className="admin-checkbox-label t-table">
          <input
            type="checkbox"
            checked={allowedAsDefault}
            onChange={(e) => setAllowedAsDefault(e.target.checked)}
          />
          {t('admin.models.fields.allowedAsDefault')}
        </label>
        <div className="admin-field-help t-caption">{t('admin.models.fields.allowedAsDefaultHelp')}</div>
      </div>

      <div className="t-overline">{t('admin.models.fields.capabilities')}</div>

      <div className="admin-field">
        <div className="admin-checkbox-group">
          <label className="admin-checkbox-label t-table">
            <input
              type="checkbox"
              checked={capabilities.supportsVision}
              onChange={(e) => updateCaps('supportsVision', e.target.checked)}
            />
            {t('admin.models.fields.supportsVision')}
          </label>
          <label className="admin-checkbox-label t-table">
            <input
              type="checkbox"
              checked={capabilities.supportsFunctionCalling}
              onChange={(e) => updateCaps('supportsFunctionCalling', e.target.checked)}
            />
            {t('admin.models.fields.supportsFunctionCalling')}
          </label>
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.models.fields.temperature')}</label>
        <select
          className="admin-select t-body"
          value={capabilities.temperature}
          onChange={(e) => updateCaps('temperature', e.target.value as TemperatureSupport)}
        >
          {TEMPERATURE_OPTIONS.map(option => (
            <option key={option} value={option}>
              {t(`admin.models.temperatureSupport.${option}`)}
            </option>
          ))}
        </select>
        <div className="af-note t-ui-plain">{t('admin.models.fields.temperatureHint')}</div>
      </div>

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.models.fields.supportedEfforts')}</label>
        <div className="admin-checkbox-group">
          {REASONING_EFFORT_ORDER.map(level => (
            <label key={level} className="admin-checkbox-label t-table">
              <input
                type="checkbox"
                checked={capabilities.supportedEfforts.includes(level)}
                onChange={(e) => toggleEffort(level, e.target.checked)}
              />
              {t(`assistants.form.reasoningLevels.${level.toLowerCase()}`)}
            </label>
          ))}
        </div>
        <div className="af-note t-ui-plain">{t('admin.models.fields.supportedEffortsHint')}</div>
      </div>

      <div className="admin-field-grid">
        <div className="admin-field">
          <label className="admin-label t-label">{t('admin.models.fields.maxContextTokens')}</label>
          <input
            className="admin-input t-body"
            type="number"
            min={1}
            value={capabilities.maxContextTokens}
            onChange={(e) => updateCaps('maxContextTokens', parseInt(e.target.value || '0', 10))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label t-label">{t('admin.models.fields.maxOutputTokens')}</label>
          <input
            className="admin-input t-body"
            type="number"
            min={1}
            value={capabilities.maxOutputTokens}
            onChange={(e) => updateCaps('maxOutputTokens', parseInt(e.target.value || '0', 10))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label t-label">{t('admin.models.fields.defaultMaxOutputTokens')}</label>
          <input
            className="admin-input t-body"
            type="number"
            min={1}
            max={capabilities.maxOutputTokens || undefined}
            value={capabilities.defaultMaxOutputTokens}
            onChange={(e) => updateCaps('defaultMaxOutputTokens', parseInt(e.target.value || '0', 10))}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label t-label">{t('admin.models.fields.knowledgeCutoff')}</label>
          <input
            className="admin-input t-body"
            type="month"
            value={knowledgeCutoffMonth}
            onChange={(e) => setKnowledgeCutoffMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="admin-form-footer">
        <button className="admin-save-button t-ui" onClick={handleSave} disabled={!canSave || saving}>
          {saving ? t('assistants.saving') : (model ? t('common.save') : t('common.create'))}
        </button>
        <button className="admin-cancel-button t-ui" onClick={() => navigate('/admin')}>
          {t('common.cancel')}
        </button>
        {model && (
          <>
            <div className="admin-footer-spacer" />
            <button className="admin-delete-button t-ui" onClick={handleDelete}>
              {t('admin.models.actions.delete')}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ModelEditor;
