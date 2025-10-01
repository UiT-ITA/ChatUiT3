import React, { useEffect, useState } from 'react';
import { Dialog, DialogButton } from '../common/Dialog/Dialog';
import { useTranslation } from 'react-i18next';
import type { CreateModelDto, UpdateModelDto, UserRole, EndpointDto } from '../../types/admin';
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
      initial: {
        id: string;
        modelName: string;
        endpointId: string;
        allowedRoles: UserRole[];
      };
      endpoints: EndpointDto[];
      allRoles: UserRole[];
      onCancel: () => void;
      onSave: (payload: UpdateModelDto) => Promise<void> | void;
    };

const ModelModal: React.FC<ModelModalProps> = (props) => {
  const { isOpen, mode, endpoints, allRoles, onCancel, onSave } = props;
  const initialData = mode === 'edit' ? props.initial : undefined;
  const { t } = useTranslation();

  const [modelName, setModelName] = useState('');
  const [endpointId, setEndpointId] = useState('');
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setModelName(initialData?.modelName ?? '');
      setEndpointId(initialData?.endpointId ?? (endpoints?.[0]?.id ?? ''));
      setAllowedRoles(initialData?.allowedRoles ?? []);
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

  const handleSave = async () => {
    if (!modelName || !endpointId) return;
    setSaving(true);
    try {
      if (mode === 'create') {
        const payload: CreateModelDto = { modelName, endpointId, allowedRoles };
        await onSave(payload);
      } else {
        const payload: UpdateModelDto = {
          id: initialData!.id,
          modelName,
          endpointId,
          allowedRoles,
        };
        await onSave(payload);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onCancel} title={title} size="medium">
      <div className="admin-model-modal">
        <div className="form-group">
          <label className="form-label">{t('admin.models.fields.modelName')}</label>
          <input
            className="form-input"
            name="modelName"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder="e.g. gpt-4o, claude-3-5"
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('admin.models.fields.endpoint')}</label>
          <select
            className="form-select"
            name="endpointId"
            value={endpointId}
            onChange={(e) => setEndpointId(e.target.value)}
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

      <DialogButton variant="secondary" onClick={onCancel}>
        {t('common.cancel')}
      </DialogButton>
      <DialogButton
        variant="primary"
        onClick={handleSave}
        disabled={!modelName || !endpointId}
        loading={saving}
      >
        {mode === 'create' ? t('common.create') : t('common.save')}
      </DialogButton>
    </Dialog>
  );
};

export default ModelModal;
