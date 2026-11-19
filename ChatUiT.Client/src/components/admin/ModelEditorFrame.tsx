import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ModelDto } from '../../types/admin';
import type { ModelType } from '../../types/modelModels';
import EditorHeader from '../layout/EditorHeader';
import EmptyNote from '../common/EmptyNote';
import PageTitleBar from '../common/PageTitleBar';
import Stack from '../common/Stack';
import Text from '../common/Text';
import { EndpointSelect, KnownModelSelect, ModelEditorFooter, ModelIdField } from './ModelEditorParts';
import { catalogEntryForModelId, modelIdOptions, type BaseModelForm, type useModelEditor } from './modelEditorShared';

type ModelEditor<M extends ModelDto, F extends BaseModelForm, T extends ModelType> = ReturnType<typeof useModelEditor<M, F, T>>;

interface ModelEditorFrameProps<M extends ModelDto, F extends BaseModelForm, T extends ModelType> {
  editor: ModelEditor<M, F, T>;
  title: string;
  canSave: boolean;
  onSave: () => void;
  // The fields after the model field, shown once an endpoint and a model id are set
  children: React.ReactNode;
}

/** A model editor page: the header with save, the endpoint, model id and known model fields, the editor's own fields and the footer. */
function ModelEditorFrame<M extends ModelDto, F extends BaseModelForm, T extends ModelType>({ editor, title, canSave, onSave, children }: ModelEditorFrameProps<M, F, T>) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { editId, models, endpoints, model, form, set, presetId, setPresetId, catalog, deployments, applyCatalogEntry, saving, dirty } = editor;

  if (editId && models === undefined) return <EmptyNote>{t('common.loading')}</EmptyNote>;
  if (editId && !model) return <EmptyNote>{t('common.notFound')}</EmptyNote>;

  const endpointType = endpoints.find(ep => ep.id === form.endpointId)?.endpointType;
  const modelOptions = modelIdOptions(deployments, catalog, endpointType, models, form.endpointId);
  const changeModelId = (value: string) => {
    const entry = catalogEntryForModelId(value, deployments, catalog);
    if (entry) applyCatalogEntry(entry, value);
    else set({ modelId: value } as Partial<F>);
  };

  return (
    <>
      <EditorHeader
        backPath="/admin/models"
        backLabel={t('admin.tabs.models')}
        dirty={dirty}
        saveLabel={saving ? t('assistants.saving') : (model ? t('common.save') : t('common.create'))}
        saveDisabled={!canSave || saving}
        onSave={onSave}
        onCancel={() => navigate('/admin/models')}
      />
      <Text as="h1" variant="page-title">{title}</Text>
      <PageTitleBar />

      <Stack gap="xl">
        <EndpointSelect value={form.endpointId} endpoints={endpoints} onChange={endpointId => set({ endpointId } as Partial<F>)} />
        {form.endpointId && <ModelIdField value={form.modelId} options={modelOptions} onChange={changeModelId} />}
        {form.endpointId && catalog.length > 0 && (
          <KnownModelSelect
            catalog={catalog}
            value={presetId}
            onSelect={(entry) => applyCatalogEntry(entry, form.modelId)}
            onClear={() => setPresetId('')}
          />
        )}
        {form.endpointId && form.modelId && children}
      </Stack>

      {model && <ModelEditorFooter modelId={model.id} dirty={dirty} />}
    </>
  );
}

export default ModelEditorFrame;
