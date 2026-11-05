import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { updateAppSettings } from '../../services/adminService';
import { adminAssistantsSignal, adminLanguageModelsSignal, adminSettingsSignal, loadAdminData } from '../../services/adminDataService';
import { refreshAppDefaults } from '../../services/appSettingsService';
import type { LanguageModelDto } from '../../types/admin';
import EditorHeader from '../layout/EditorHeader';
import Select from '../common/Select';
import Stack from '../common/Stack';
import { hasChanges } from '../../utils/formChanges';
import PageTitleBar from '../common/PageTitleBar';
import EmptyNote from '../common/EmptyNote';
import { PageIntro } from '../common/Page';
import Box from '../common/Box';
import Text from '../common/Text';

const SettingsEditor: React.FC = () => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const models = adminLanguageModelsSignal.value;
  const assistants = adminAssistantsSignal.value;
  const settings = adminSettingsSignal.value;

  const [defaultModelId, setDefaultModelId] = useState(settings?.defaultModelId ?? '');
  const [chatNamingModelId, setChatNamingModelId] = useState(settings?.chatNamingModelId ?? '');
  const [defaultAssistantId, setDefaultAssistantId] = useState(settings?.defaultAssistantId ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAdminData();
  }, []);

  const [syncedSettings, setSyncedSettings] = useState(settings);
  if (settings !== syncedSettings) {
    setSyncedSettings(settings);
    setDefaultModelId(settings?.defaultModelId ?? '');
    setChatNamingModelId(settings?.chatNamingModelId ?? '');
    setDefaultAssistantId(settings?.defaultAssistantId ?? '');
  }

  if (settings === undefined || models === undefined || assistants === undefined) {
    return <EmptyNote>{t('common.loading')}</EmptyNote>;
  }

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateAppSettings({ defaultModelId, chatNamingModelId, defaultAssistantId });
      await loadAdminData(true);
      await refreshAppDefaults();
    } finally {
      setSaving(false);
    }
  };

  const renderModelSelect = (label: string, description: string, value: string, onChange: (next: string) => void) => (
    <Select label={label} description={description} value={value} onChange={onChange}>
      <option value="">{t('admin.settings.fields.none')}</option>
      {models.map((model: LanguageModelDto) => (
        <option key={model.id} value={model.id}>
          {model.modelName} ({model.modelId})
        </option>
      ))}
    </Select>
  );

  const dirty = hasChanges(
    { defaultModelId, chatNamingModelId, defaultAssistantId },
    { defaultModelId: settings.defaultModelId ?? '', chatNamingModelId: settings.chatNamingModelId ?? '', defaultAssistantId: settings.defaultAssistantId ?? '' },
  );

  return (
    <Box maxWidth="md">
      <EditorHeader
        backPath="/admin"
        backLabel={t('contextColumn.admin')}
        dirty={dirty}
        saveLabel={saving ? t('assistants.saving') : t('common.save')}
        saveDisabled={saving}
        onSave={handleSave}
        onCancel={() => navigate('/admin')}
      />
      <Text as="h1" variant="page-title">{t('admin.settings.title')}</Text>
      <PageTitleBar />
      <PageIntro>{t('admin.settings.intro')}</PageIntro>

      {models.length === 0 && (
        <EmptyNote>{t('admin.models.list.empty')}</EmptyNote>
      )}

      <Stack gap="xl">
        {renderModelSelect(t('admin.settings.fields.defaultModel'), t('admin.settings.fields.defaultModelHelp'), defaultModelId, setDefaultModelId)}

        {renderModelSelect(t('admin.settings.fields.chatNamingModel'), t('admin.settings.fields.chatNamingModelHelp'), chatNamingModelId, setChatNamingModelId)}

        <Select
          label={t('admin.settings.fields.defaultAssistant')}
          description={t('admin.settings.fields.defaultAssistantHelp')}
          value={defaultAssistantId}
          onChange={setDefaultAssistantId}
        >
          <option value="">{t('admin.settings.fields.none')}</option>
          {assistants.map((assistant) => (
            <option key={assistant.id} value={assistant.id}>
              {assistant.name}
            </option>
          ))}
        </Select>
      </Stack>
    </Box>
  );
};

export default SettingsEditor;
