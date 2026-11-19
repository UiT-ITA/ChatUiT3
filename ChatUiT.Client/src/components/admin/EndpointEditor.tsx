import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { createEndpoint, updateEndpoint, deleteEndpoint, deleteModel } from '../../services/adminService';
import { adminEndpointsSignal, adminModelsSignal, loadAdminData } from '../../services/adminDataService';
import type { EndpointAuthMethod, EndpointType } from '../../types/admin';
import EditorHeader from '../layout/EditorHeader';
import { Dialog } from '../common/Dialog';
import Select from '../common/Select';
import TextInput from '../common/TextInput';
import Button from '../common/Button';
import Stack from '../common/Stack';
import { useEditorForm } from '../../hooks/useEditorForm';
import { useBusy } from '../../hooks/useBusy';
import PageTitleBar from '../common/PageTitleBar';
import EmptyNote from '../common/EmptyNote';
import FormFooter from '../common/FormFooter';
import Box from '../common/Box';
import Text from '../common/Text';
import { ErrorCode, formatError } from '../../errors/errorCodes';

const PROVIDERS: EndpointType[] = ['AzureOpenAI', 'MicrosoftFoundry', 'Anthropic', 'OpenAI', 'LlamaCpp', 'Other'];
/** The endpoint types that accept the app's Entra identity. */
const MANAGED_IDENTITY_PROVIDERS: EndpointType[] = ['AzureOpenAI', 'MicrosoftFoundry'];
const AUTH_METHODS: EndpointAuthMethod[] = ['ApiKey', 'ManagedIdentity'];

interface EndpointEditorProps {
  endpointId?: string;
}

const EndpointEditor: React.FC<EndpointEditorProps> = ({ endpointId }) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const endpoints = adminEndpointsSignal.value;
  const endpoint = endpointId ? endpoints?.find(e => e.id === endpointId) : undefined;

  const { form, set, dirty } = useEditorForm(() => ({
    url: endpoint?.url ?? '',
    apiKey: '',
    endpointType: endpoint?.endpointType ?? 'AzureOpenAI' as EndpointType,
    authMethod: endpoint?.authMethod ?? 'ApiKey' as EndpointAuthMethod,
  }), [endpoint]);
  const { url, apiKey, endpointType, authMethod } = form;
  const [saving, runSave] = useBusy();
  const [deleting, runDelete] = useBusy();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const connectedModels = endpointId ? (adminModelsSignal.value ?? []).filter(m => m.endpointId === endpointId) : [];

  if (endpointId && endpoints === undefined) {
    return <EmptyNote>{t('common.loading')}</EmptyNote>;
  }

  if (endpointId && endpoints !== undefined && !endpoint) {
    return <EmptyNote>{formatError(t('common.notFound'), ErrorCode.AdminItemNotFound)}</EmptyNote>;
  }

  const finish = async () => {
    await loadAdminData(true);
    navigate('/admin/endpoints');
  };

  const handleSave = () => runSave(async () => {
    if (!url) return;
    if (endpoint) {
      await updateEndpoint(endpoint.id, { id: endpoint.id, ...form });
    } else {
      await createEndpoint(form);
    }
    await finish();
  });

  const handleDelete = (withModels: boolean) => runDelete(async () => {
    if (!endpoint) return;
    if (withModels) {
      for (const model of connectedModels) {
        await deleteModel(model.id);
      }
    }
    await deleteEndpoint(endpoint.id);
    await finish();
  });
  // A key is needed when none is stored: a new endpoint, or one that used managed identity until now.
  const needsApiKey = authMethod === 'ApiKey' && (!endpoint || endpoint.authMethod === 'ManagedIdentity');

  const handleEndpointTypeChange = (value: EndpointType) =>
    set(MANAGED_IDENTITY_PROVIDERS.includes(value) ? { endpointType: value } : { endpointType: value, authMethod: 'ApiKey' });

  return (
    <Box maxWidth="md">
      <EditorHeader
        backPath="/admin/endpoints"
        backLabel={t('admin.tabs.endpoints')}
        dirty={dirty}
        saveLabel={saving ? t('assistants.saving') : (endpoint ? t('common.save') : t('common.create'))}
        saveDisabled={!url || (needsApiKey && !apiKey) || saving}
        onSave={handleSave}
        onCancel={() => navigate('/admin/endpoints')}
      />
      <Text as="h1" variant="page-title">
        {endpoint ? t('admin.endpoints.dialog.edit.title') : t('admin.endpoints.add.title')}
      </Text>
      <PageTitleBar />

      <Stack gap="xl">
        <TextInput
          label={t('admin.endpoints.fields.url')}
          description={
            endpointType === 'Anthropic' ? t('admin.endpoints.fields.urlHelpAnthropic')
              : endpointType === 'MicrosoftFoundry' ? t('admin.endpoints.fields.urlHelpFoundry')
                : endpointType === 'AzureOpenAI' ? t('admin.endpoints.fields.urlHelpAzureOpenAI')
                  : undefined
          }
          value={url}
          onChange={value => set({ url: value })}
          placeholder="https://..."
        />

        <Select
          label={t('admin.endpoints.fields.provider')}
          value={endpointType}
          onChange={(value) => handleEndpointTypeChange(value as EndpointType)}
        >
          {PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {t(`admin.endpointType.${provider}`)}
            </option>
          ))}
        </Select>

        {MANAGED_IDENTITY_PROVIDERS.includes(endpointType) && (
          <Select
            label={t('admin.endpoints.fields.authMethod')}
            description={authMethod === 'ManagedIdentity' ? t('admin.endpoints.fields.authMethodHelpManagedIdentity') : undefined}
            value={authMethod}
            onChange={(value) => set({ authMethod: value as EndpointAuthMethod })}
          >
            {AUTH_METHODS.map((method) => (
              <option key={method} value={method}>
                {t(`admin.endpointAuthMethod.${method}`)}
              </option>
            ))}
          </Select>
        )}

        {authMethod === 'ApiKey' && (
          <TextInput
            label={t('admin.endpoints.fields.apiKey')}
            type="password"
            value={apiKey}
            onChange={value => set({ apiKey: value })}
            placeholder={needsApiKey ? undefined : '••••••••••••••••••••'}
          />
        )}
      </Stack>

      {endpoint && (
        <FormFooter>
          <Button variant="danger" ml="auto" onClick={() => setConfirmDelete(true)}>
            {t('admin.endpoints.actions.delete')}
          </Button>
        </FormFooter>
      )}

      <Dialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('admin.endpoints.dialog.delete.title')}
        size="medium"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => handleDelete(false)}
              disabled={deleting}
              autoFocus={connectedModels.length === 0}
            >
              {connectedModels.length > 0
                ? t('admin.endpoints.dialog.delete.endpointOnly')
                : t('admin.endpoints.dialog.delete.endpoint')}
            </Button>
            {connectedModels.length > 0 && (
              <Button variant="danger" onClick={() => handleDelete(true)} disabled={deleting} autoFocus>
                {t('admin.endpoints.dialog.delete.endpointAndModels')}
              </Button>
            )}
          </>
        )}
      >
        <Text as="p" variant="body">{t('admin.endpoints.dialog.delete.confirm')}</Text>
        {connectedModels.length > 0 ? (
          <>
            <Text as="p" variant="body">{t('admin.endpoints.dialog.delete.modelsIntro', { count: connectedModels.length })}</Text>
            <Text as="ul" variant="body">
              {connectedModels.map(m => (
                <li key={m.id}>{m.modelName} ({m.modelId})</li>
              ))}
            </Text>
          </>
        ) : (
          <Text as="p" variant="body">{t('admin.endpoints.dialog.delete.noModels')}</Text>
        )}
      </Dialog>
    </Box>
  );
};

export default EndpointEditor;
