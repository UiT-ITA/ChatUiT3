import React, { useEffect, useState } from 'react';
import { Dialog, DialogButton } from '../common/Dialog/Dialog';
import { useTranslation } from 'react-i18next';
import type { EndpointType, CreateEndpointDto, UpdateEndpointDto } from '../../types/admin';
import './EndpointModal.css';

type EndpointModalProps =
  | {
      isOpen: boolean;
      mode: 'create';
      initial?: undefined;
      onCancel: () => void;
      onSave: (payload: CreateEndpointDto) => Promise<void> | void;
    }
  | {
      isOpen: boolean;
      mode: 'edit';
      initial: {
        id: string;
        url: string;
        endpointType: EndpointType;
      };
      onCancel: () => void;
      onSave: (payload: UpdateEndpointDto) => Promise<void> | void;
    };

const PROVIDERS: EndpointType[] = ['AzureOpenAI', 'OpenAI', 'Anthropic', 'LlamaCpp', 'Other'];

const EndpointModal: React.FC<EndpointModalProps> = ({ isOpen, mode, initial, onCancel, onSave }) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [endpointType, setEndpointType] = useState<EndpointType>('AzureOpenAI');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrl(initial?.url ?? '');
      setApiKey('');
      setEndpointType(initial?.endpointType ?? 'AzureOpenAI');
      setSaving(false);
    }
  }, [isOpen, initial]);

  const title = mode === 'create' ? t('admin.endpoints.add.title') : t('admin.endpoints.dialog.edit.title');

  const handleSave = async () => {
    if (!url) return;
    setSaving(true);
    try {
      if (mode === 'create') {
        const payload: CreateEndpointDto = { url, apiKey, endpointType };
        await onSave(payload);
      } else {
        const payload: UpdateEndpointDto = {
          id: initial.id,
          url,
          apiKey,
          endpointType,
        };
        await onSave(payload);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onCancel} title={title} size="medium">
      <div className="admin-endpoint-modal">
        <div className="form-group">
          <label className="form-label">{t('admin.endpoints.fields.url')}</label>
          <input
            className="form-input"
            name="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('admin.endpoints.fields.apiKey')}</label>
          <input
            className="form-input"
            type="password"
            name="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('admin.endpoints.fields.provider')}</label>
          <select
            className="form-select"
            name="endpointType"
            value={endpointType}
            onChange={(e) => setEndpointType(e.target.value as EndpointType)}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DialogButton variant="secondary" onClick={onCancel}>
        {t('common.cancel')}
      </DialogButton>
      <DialogButton
        variant="primary"
        onClick={handleSave}
        disabled={!url || (mode === 'create' && !apiKey)}
        loading={saving}
      >
        {mode === 'create' ? t('common.create') : t('common.save')}
      </DialogButton>
    </Dialog>
  );
};

export default EndpointModal;
