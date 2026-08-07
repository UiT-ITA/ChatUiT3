import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { updateAppSettings } from '../../services/adminService';
import { adminModelsSignal, adminSettingsSignal, loadAdminData } from '../../services/adminDataService';
import { refreshAppDefaults } from '../../services/appSettingsService';
import type { ModelDto } from '../../types/admin';

const SettingsEditor: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const models = adminModelsSignal.value;
  const settings = adminSettingsSignal.value;

  const [defaultModelId, setDefaultModelId] = useState('');
  const [chatNamingModelId, setChatNamingModelId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    setDefaultModelId(settings?.defaultModelId ?? '');
    setChatNamingModelId(settings?.chatNamingModelId ?? '');
  }, [settings]);

  if (settings === undefined || models === undefined) {
    return <div className="admin-empty t-ui-plain">{t('common.loading')}</div>;
  }

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateAppSettings({ defaultModelId, chatNamingModelId });
      await loadAdminData(true);
      await refreshAppDefaults();
    } finally {
      setSaving(false);
    }
  };

  const renderModelSelect = (value: string, onChange: (next: string) => void) => (
    <select className="admin-select t-body" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('admin.settings.fields.none')}</option>
      {models.map((model: ModelDto) => (
        <option key={model.id} value={model.id}>
          {model.modelName} ({model.modelId})
        </option>
      ))}
    </select>
  );

  return (
    <div className="admin-form">
      <h1 className="t-page-title">{t('admin.settings.title')}</h1>
      <div className="page-title-bar" />
      <p className="admin-intro t-body-lg">{t('admin.settings.intro')}</p>

      {models.length === 0 && (
        <div className="admin-empty t-ui-plain">{t('admin.models.list.empty')}</div>
      )}

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.settings.fields.defaultModel')}</label>
        {renderModelSelect(defaultModelId, setDefaultModelId)}
        <div className="admin-field-help t-caption">{t('admin.settings.fields.defaultModelHelp')}</div>
      </div>

      <div className="admin-field">
        <label className="admin-label t-label">{t('admin.settings.fields.chatNamingModel')}</label>
        {renderModelSelect(chatNamingModelId, setChatNamingModelId)}
        <div className="admin-field-help t-caption">{t('admin.settings.fields.chatNamingModelHelp')}</div>
      </div>

      <div className="admin-form-footer">
        <button className="admin-save-button t-ui" onClick={handleSave} disabled={saving}>
          {saving ? t('assistants.saving') : t('common.save')}
        </button>
        <button className="admin-cancel-button t-ui" onClick={() => navigate('/admin')}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
};

export default SettingsEditor;
