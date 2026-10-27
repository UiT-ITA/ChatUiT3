import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { createEndpoint, updateEndpoint, deleteEndpoint } from '../../services/adminService';
import { adminEndpointsSignal, loadAdminData } from '../../services/adminDataService';
import type { EndpointType } from '../../types/admin';
import EditorHeader from '../layout/EditorHeader';
import { hasChanges } from '../../utils/formChanges';

const PROVIDERS: EndpointType[] = ['AzureOpenAI', 'MicrosoftFoundry', 'Anthropic', 'OpenAI', 'LlamaCpp', 'Other'];

interface EndpointEditorProps {
  endpointId?: string;
}

const EndpointEditor: React.FC<EndpointEditorProps> = ({ endpointId }) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const endpoints = adminEndpointsSignal.value;
  const endpoint = endpointId ? endpoints?.find(e => e.id === endpointId) : undefined;

  const [url, setUrl] = useState(endpoint?.url ?? '');
  const [apiKey, setApiKey] = useState('');
  const [endpointType, setEndpointType] = useState<EndpointType>(endpoint?.endpointType ?? 'AzureOpenAI');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const [syncedEndpoint, setSyncedEndpoint] = useState(endpoint);
  if (endpoint !== syncedEndpoint) {
    setSyncedEndpoint(endpoint);
    setUrl(endpoint?.url ?? '');
    setApiKey('');
    setEndpointType(endpoint?.endpointType ?? 'AzureOpenAI');
  }

  if (endpointId && endpoints === undefined) {
    return <div className="admin-empty t-ui-plain">{t('common.loading')}</div>;
  }

  if (endpointId && endpoints !== undefined && !endpoint) {
    return <div className="admin-empty t-ui-plain">{t('common.notFound')}</div>;
  }

  const handleSave = async () => {
    if (!url || saving) return;
    setSaving(true);
    try {
      if (endpoint) {
        await updateEndpoint(endpoint.id, { id: endpoint.id, url, apiKey, endpointType });
      } else {
        await createEndpoint({ url, apiKey, endpointType });
      }
      await loadAdminData(true);
      navigate('/admin/endpoints');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!endpoint) return;
    if (!window.confirm(t('admin.endpoints.dialog.delete.confirm'))) return;
    await deleteEndpoint(endpoint.id);
    await loadAdminData(true);
    navigate('/admin/endpoints');
  };

  const dirty = hasChanges(
    { url, apiKey, endpointType },
    { url: endpoint?.url ?? '', apiKey: '', endpointType: endpoint?.endpointType ?? 'AzureOpenAI' },
  );

  return (
    <div className="admin-form">
      <EditorHeader
        backPath="/admin/endpoints"
        backLabel={t('admin.tabs.endpoints')}
        dirty={dirty}
        saveLabel={saving ? t('assistants.saving') : (endpoint ? t('common.save') : t('common.create'))}
        saveDisabled={!url || (!endpoint && !apiKey) || saving}
        onSave={handleSave}
        onCancel={() => navigate('/admin/endpoints')}
      />
      <h1 className="t-page-title">
        {endpoint ? t('admin.endpoints.dialog.edit.title') : t('admin.endpoints.add.title')}
      </h1>
      <div className="page-title-bar" />

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.endpoints.fields.url')}</label>
        {endpointType === 'Anthropic' && (
          <div className="admin-field-help t-caption">{t('admin.endpoints.fields.urlHelpAnthropic')}</div>
        )}
        {endpointType === 'MicrosoftFoundry' && (
          <div className="admin-field-help t-caption">{t('admin.endpoints.fields.urlHelpFoundry')}</div>
        )}
        {endpointType === 'AzureOpenAI' && (
          <div className="admin-field-help t-caption">{t('admin.endpoints.fields.urlHelpAzureOpenAI')}</div>
        )}
        <input
          className="admin-input t-body"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.endpoints.fields.apiKey')}</label>
        <input
          className="admin-input t-body"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={endpoint ? '••••••••••••••••••••' : undefined}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.endpoints.fields.provider')}</label>
        <select
          className="admin-select t-body"
          value={endpointType}
          onChange={(e) => setEndpointType(e.target.value as EndpointType)}
        >
          {PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {t(`admin.endpointType.${provider}`)}
            </option>
          ))}
        </select>
      </div>

      {endpoint && (
        <div className="admin-form-footer">
          <div className="admin-footer-spacer" />
          <button className="admin-delete-button t-ui" onClick={handleDelete}>
            {t('admin.endpoints.actions.delete')}
          </button>
        </div>
      )}
    </div>
  );
};

export default EndpointEditor;
