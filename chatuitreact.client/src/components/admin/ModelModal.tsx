import React, { useEffect, useState } from 'react';
import { Dialog, DialogPage, DialogButton } from '../common/Dialog';
import { useTranslation } from 'react-i18next';
import type { CreateModelDto, UpdateModelDto, UserRole, EndpointDto, ModelDto, ModelCapabilities } from '../../types/admin';
import './ModelModal.css';

type ModelModalProps =
  | {
      isOpen: boolean;
      mode: 'create';
      endpoints: EndpointDto[];
      allRoles: UserRole[];
      onCancel: () => void;
      onSave: (payload: CreateModelDto) => Promise<void> | void;
    }
  | {
      isOpen: boolean;
      mode: 'edit';
      initial: ModelDto;
      endpoints: EndpointDto[];
      allRoles: UserRole[];
      onCancel: () => void;
      onSave: (payload: UpdateModelDto) => Promise<void> | void;
    };

const defaultCapabilities: ModelCapabilities = {
  supportsVision: false,
  supportsReasoning: false,
  supportsFunctionCalling: false,
  supportsTemperature: false,
  maxContextLength: 16000,
  maxOutputLength: 16000,
  knowledgeCutoff: '2024-01-01T00:00:00Z',
};

const ModelModal: React.FC<ModelModalProps> = (props) => {
  const { isOpen, mode, endpoints, allRoles, onCancel, onSave } = props;
  const initialData = mode === 'edit' ? props.initial : undefined;
  const { t } = useTranslation();

  const [modelId, setModelId] = useState('');
  const [modelName, setModelName] = useState('');
  const [description, setDescription] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>([]);
  const [capabilities, setCapabilities] = useState<ModelCapabilities>(defaultCapabilities);
  const [knowledgeCutoffMonth, setKnowledgeCutoffMonth] = useState<string>(''); // YYYY-MM only
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setModelId(initialData?.modelId ?? '');
      setModelName(initialData?.modelName ?? '');
      setDescription(initialData?.description ?? '');
      setEndpointId(initialData?.endpointId ?? (endpoints?.[0]?.id ?? ''));
      setAllowedRoles(initialData?.allowedRoles ?? []);
      const caps = initialData?.capabilities ?? defaultCapabilities;
      setCapabilities(caps);
      const iso = caps.knowledgeCutoff || defaultCapabilities.knowledgeCutoff;
      // Convert ISO string to YYYY-MM; fallback to empty if invalid
      const ym = typeof iso === 'string' && iso.length >= 7 ? iso.slice(0, 7) : '';
      setKnowledgeCutoffMonth(ym);
      setSaving(false);
    }
  }, [isOpen, initialData, endpoints]);

  const title = mode === 'create' ? t('admin.models.add.title') : t('admin.models.dialog.edit.title');

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

  const canSave =
    !!modelId &&
    !!modelName &&
    !!description &&
    !!endpointId &&
    Number.isFinite(capabilities.maxContextLength) &&
    Number(capabilities.maxContextLength) > 0 &&
    Number.isFinite(capabilities.maxOutputLength) &&
    Number(capabilities.maxOutputLength) > 0 &&
    !!knowledgeCutoffMonth;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const knowledgeCutoffIso = `${knowledgeCutoffMonth}-01T00:00:00Z`;
      const capsToSend: ModelCapabilities = {
        ...capabilities,
        knowledgeCutoff: knowledgeCutoffIso,
      };

      if (mode === 'create') {
        const payload: CreateModelDto = {
          modelId,
          modelName,
          description,
          endpointId,
          allowedRoles,
          capabilities: capsToSend,
        };
        await onSave(payload);
      } else {
        const payload: UpdateModelDto = {
          id: initialData!.id,
          modelId,
          modelName,
          description,
          endpointId,
          allowedRoles,
          capabilities: capsToSend,
        };
        await onSave(payload);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onCancel} title={title} size="large">
      <DialogPage id="details" label="Details" icon="user">
        <div className="admin-model-modal">
          <div className="form-group">
            <label className="form-label">{t('admin.models.fields.modelId') || 'Model ID'}</label>
            <input
              className="form-input"
              name="modelId"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g. gpt-4o, claude-3-5-sonnet"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('admin.models.fields.modelName')}</label>
            <input
              className="form-input"
              name="modelName"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="Friendly name (e.g. GPT‑4o Prod)"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('admin.models.fields.description') || 'Description'}</label>
            <textarea
              className="form-input"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description for this model"
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('admin.models.fields.endpoint')}</label>
            <select
              className="form-select"
              name="endpointId"
              value={endpointId}
              onChange={(e) => setEndpointId(e.target.value)}
              required
            >
              {endpoints.map(ep => (
                <option key={ep.id} value={ep.id}>
                  {ep.url}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">{t('admin.models.fields.allowedRoles')}</label>
            <div className="roles-wrap">
              {allRoles.map(role => {
                const checked = allowedRoles.includes(role);
                return (
                  <label key={role} className="role-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleRole(role, e.target.checked)}
                    />
                    {t(`roles.${role}`)}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </DialogPage>

      <DialogPage id="capabilities" label="Capabilities" icon="settings">
        <div className="admin-model-modal">
          <div className="form-group">
            <label className="form-label">{t('admin.models.fields.capabilities') || 'Capabilities'}</label>
            <div className="capabilities-grid">
              <label className="cap-item">
                <input
                  type="checkbox"
                  checked={capabilities.supportsVision}
                  onChange={(e) => updateCaps('supportsVision', e.target.checked)}
                />
                {t('admin.models.fields.supportsVision') || 'Supports Vision'}
              </label>
              <label className="cap-item">
                <input
                  type="checkbox"
                  checked={capabilities.supportsReasoning}
                  onChange={(e) => updateCaps('supportsReasoning', e.target.checked)}
                />
                {t('admin.models.fields.supportsReasoning') || 'Supports Reasoning'}
              </label>
              <label className="cap-item">
                <input
                  type="checkbox"
                  checked={capabilities.supportsFunctionCalling}
                  onChange={(e) => updateCaps('supportsFunctionCalling', e.target.checked)}
                />
                {t('admin.models.fields.supportsFunctionCalling') || 'Supports Function Calling'}
              </label>
              <label className="cap-item">
                <input
                  type="checkbox"
                  checked={capabilities.supportsTemperature}
                  onChange={(e) => updateCaps('supportsTemperature', e.target.checked)}
                />
                {t('admin.models.fields.supportsTemperature') || 'Supports Temperature'}
              </label>
            </div>

            <div className="capabilities-numbers">
              <div className="form-group">
                <label className="form-label">{t('admin.models.fields.maxContextLength') || 'Max Context Length'}</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  value={capabilities.maxContextLength}
                  onChange={(e) => updateCaps('maxContextLength', parseInt(e.target.value || '0', 10))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('admin.models.fields.maxOutputLength') || 'Max Output Length'}</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  value={capabilities.maxOutputLength}
                  onChange={(e) => updateCaps('maxOutputLength', parseInt(e.target.value || '0', 10))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('admin.models.fields.knowledgeCutoff') || 'Knowledge Cutoff'}</label>
                <input
                  className="form-input"
                  type="month"
                  value={knowledgeCutoffMonth}
                  onChange={(e) => setKnowledgeCutoffMonth(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
        </div>
      </DialogPage>

      <DialogButton variant="secondary" onClick={onCancel}>
        {t('common.cancel')}
      </DialogButton>
      <DialogButton
        variant="primary"
        onClick={handleSave}
        disabled={!canSave}
        loading={saving}
      >
        {mode === 'create' ? t('common.create') : t('common.save')}
      </DialogButton>
    </Dialog>
  );
};

export default ModelModal;
