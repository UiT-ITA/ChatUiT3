import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { createImageModel, updateImageModel } from '../../services/adminService';
import { adminEndpointsSignal, adminModelsSignal, loadAdminData } from '../../services/adminDataService';
import type { UserRole, ImageCatalogModelDto, ImageModelDto, EndpointDto } from '../../types/admin';
import { isImageModel } from '../../types/admin';
import {
  IMAGE_APIS,
  IMAGE_BACKGROUNDS,
  IMAGE_FORMATS,
  IMAGE_MODERATION_LEVELS,
  IMAGE_QUALITIES,
  type ImageApi,
  type ImageEditCapabilities,
  type ImageModelCapabilities,
  type ImageSize,
} from '../../types/modelModels';
import EditorHeader from '../layout/EditorHeader';
import Select from '../common/Select';
import TextInput from '../common/TextInput';
import TextArea from '../common/TextArea';
import Checkbox, { CheckboxGroup } from '../common/Checkbox';
import Field from '../common/Field';
import Button from '../common/Button';
import IconButton from '../common/IconButton';
import Stack from '../common/Stack';
import Grid from '../common/Grid';
import { hasChanges } from '../../utils/formChanges';
import { AllowedRolesField, EndpointSelect, KnownModelSelect, ModelEditorFooter, ModelIdField } from './ModelEditorParts';
import { ALL_ROLES, catalogEntryForModelId, modelIdOptions, useEndpointDeployments, useModelCatalog } from './modelEditorShared';

const BYTES_PER_MEGABYTE = 1024 * 1024;

const defaultCapabilities: ImageModelCapabilities = {
  sizePresets: [{ width: 1024, height: 1024 }],
  supportsAutoSize: false,
  supportsCustomSize: false,
  sizeMultiple: null,
  minSide: null,
  maxSide: null,
  minPixels: null,
  maxPixels: null,
  maxAspectRatio: null,
  supportsAutoAspectRatio: false,
  qualities: [],
  maxImagesPerRequest: 1,
  outputFormats: ['Png'],
  supportsCompression: false,
  backgrounds: [],
  moderationLevels: [],
  maxPartialImages: 0,
  supportsWebGrounding: false,
  maxPromptCharacters: null,
  editing: null,
};

const defaultEditing: ImageEditCapabilities = {
  maxInputImages: 1,
  inputFormats: ['Png', 'Jpeg'],
  maxInputImageBytes: null,
  supportsMask: false,
  supportsMarkup: false,
  acceptsGenerationSettings: false,
};

interface ImageModelEditorProps {
  modelId?: string;
}

/** The form's field values for a model, or the defaults for a new one. */
function formStateFor(model: ImageModelDto | undefined, endpoints: EndpointDto[]) {
  return {
    modelId: model?.modelId ?? '',
    modelName: model?.modelName ?? '',
    description: model?.description ?? '',
    // A new model starts on the first endpoint. An existing model whose endpoint was deleted starts empty, so the admin must pick one.
    endpointId: model
      ? (endpoints.some(ep => ep.id === model.endpointId) ? model.endpointId : '')
      : (endpoints[0]?.id ?? ''),
    // A new model is available to everyone; an existing one keeps exactly the roles it was saved with.
    allowedRoles: model ? (model.allowedRoles ?? []) : [...ALL_ROLES],
    // '' until the admin picks one for a new model.
    imageApi: (model?.imageApi ?? '') as ImageApi | '',
    capabilities: model?.capabilities ?? defaultCapabilities,
  };
}

/** Keeps the values of a checkbox list in the order of `all`. */
function toggled<T>(all: T[], current: T[], value: T, checked: boolean): T[] {
  const next = new Set(current);
  if (checked) next.add(value);
  else next.delete(value);
  return all.filter(v => next.has(v));
}

/** A number input where empty means no limit. */
const OptionalNumberInput: React.FC<{ label: string; value: number | null; step?: string; onChange: (value: number | null) => void }> = ({ label, value, step, onChange }) => {
  const { t } = useTranslation();
  return (
    <TextInput
      label={label}
      type="number"
      min={0}
      step={step}
      placeholder={t('admin.imageModels.fields.noLimit')}
      value={value ?? ''}
      onChange={(text) => onChange(text === '' ? null : Number(text))}
    />
  );
};

const ImageModelEditor: React.FC<ImageModelEditorProps> = ({ modelId: editId }) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const models = adminModelsSignal.value;
  const endpoints = adminEndpointsSignal.value ?? [];
  const stored = editId ? models?.find(m => m.id === editId) : undefined;
  const model = stored && isImageModel(stored) ? stored : undefined;

  const initial = formStateFor(model, endpoints);
  const [modelId, setModelId] = useState(initial.modelId);
  const [modelName, setModelName] = useState(initial.modelName);
  const [description, setDescription] = useState(initial.description);
  const [endpointId, setEndpointId] = useState(initial.endpointId);
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>(initial.allowedRoles);
  const [imageApi, setImageApi] = useState<ImageApi | ''>(initial.imageApi);
  const [capabilities, setCapabilities] = useState<ImageModelCapabilities>(initial.capabilities);
  const [saving, setSaving] = useState(false);
  const catalog = useModelCatalog('Image');
  // The catalog entry last applied, or '' for custom values
  const [presetId, setPresetId] = useState('');
  const deployments = useEndpointDeployments(endpointId);

  useEffect(() => {
    loadAdminData();
  }, []);

  const endpointType = endpoints.find(ep => ep.id === endpointId)?.endpointType;
  const modelOptions = modelIdOptions(deployments, catalog, endpointType, models, endpointId);

  const [synced, setSynced] = useState({ model, endpointCount: endpoints.length });
  if (model !== synced.model || endpoints.length !== synced.endpointCount) {
    setSynced({ model, endpointCount: endpoints.length });
    const next = formStateFor(model, endpoints);
    setModelId(next.modelId);
    setModelName(next.modelName);
    setDescription(next.description);
    setEndpointId(next.endpointId);
    setAllowedRoles(next.allowedRoles);
    setImageApi(next.imageApi);
    setCapabilities(next.capabilities);
    setPresetId('');
  }

  if (editId && models === undefined) {
    return <div className="admin-empty t-ui-plain">{t('common.loading')}</div>;
  }

  if (editId && models !== undefined && !model) {
    return <div className="admin-empty t-ui-plain">{t('common.notFound')}</div>;
  }

  const updateCaps = <K extends keyof ImageModelCapabilities>(key: K, value: ImageModelCapabilities[K]) => {
    setCapabilities(prev => ({ ...prev, [key]: value }));
    setPresetId('');
  };

  const updateEditing = <K extends keyof ImageEditCapabilities>(key: K, value: ImageEditCapabilities[K]) => {
    setCapabilities(prev => ({ ...prev, editing: { ...(prev.editing ?? defaultEditing), [key]: value } }));
    setPresetId('');
  };

  const updatePreset = (index: number, size: ImageSize) =>
    updateCaps('sizePresets', capabilities.sizePresets.map((preset, i) => (i === index ? size : preset)));

  // Overwrites the API and capabilities. Model id, name and description are filled only when empty; the endpoint is never touched.
  const applyCatalogEntry = (entry: ImageCatalogModelDto, currentModelId: string) => {
    setPresetId(entry.modelId);
    if (!currentModelId) setModelId(entry.modelId);
    setImageApi(entry.imageApi);
    setCapabilities(entry.capabilities);
    if (!modelName) setModelName(entry.displayName);
    if (!description) setDescription(entry.description);
  };

  const handleModelIdChange = (value: string) => {
    setModelId(value);
    const entry = catalogEntryForModelId(value, deployments, catalog);
    if (entry) applyCatalogEntry(entry, value);
  };

  // The fields after the model field show once an endpoint and a model id are set
  const showDetails = !!endpointId && !!modelId;
  const editing = capabilities.editing;

  const canSave =
    !!modelId &&
    !!modelName &&
    !!description &&
    !!endpointId &&
    imageApi !== '' &&
    allowedRoles.length > 0 &&
    capabilities.maxImagesPerRequest >= 1 &&
    capabilities.outputFormats.length > 0 &&
    capabilities.maxPartialImages >= 0 &&
    (capabilities.sizePresets.length > 0 || capabilities.supportsAutoSize || capabilities.supportsCustomSize) &&
    capabilities.sizePresets.every(s => s.width > 0 && s.height > 0) &&
    (editing === null || (editing.maxInputImages >= 1 && editing.inputFormats.length > 0));

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const payload = { modelId, modelName, description, endpointId, allowedRoles, imageApi, capabilities };
      if (model) {
        await updateImageModel(model.id, payload);
      } else {
        await createImageModel(payload);
      }
      await loadAdminData(true);
      navigate('/admin/models');
    } finally {
      setSaving(false);
    }
  };

  const dirty = hasChanges(
    { modelId, modelName, description, endpointId, allowedRoles, imageApi, capabilities },
    initial,
  );

  return (
    <div className="admin-form admin-form-wide">
      <EditorHeader
        backPath="/admin/models"
        backLabel={t('admin.tabs.models')}
        dirty={dirty}
        saveLabel={saving ? t('assistants.saving') : (model ? t('common.save') : t('common.create'))}
        saveDisabled={!canSave || saving}
        onSave={handleSave}
        onCancel={() => navigate('/admin/models')}
      />
      <h1 className="t-page-title">
        {model ? t('admin.imageModels.editTitle') : t('admin.imageModels.addTitle')}
      </h1>
      <div className="page-title-bar" />

      <Stack gap="xl">
        <EndpointSelect value={endpointId} endpoints={endpoints} onChange={setEndpointId} />

        {endpointId && (
          <ModelIdField value={modelId} options={modelOptions} onChange={handleModelIdChange} />
        )}

        {endpointId && catalog.length > 0 && (
          <KnownModelSelect
            catalog={catalog}
            value={presetId}
            onSelect={(entry) => applyCatalogEntry(entry, modelId)}
            onClear={() => setPresetId('')}
          />
        )}

        {showDetails && (
          <>
            <Grid minColumnWidth="12rem" gap="lg">
              <TextInput
                label={t('admin.models.fields.modelName')}
                value={modelName}
                onChange={setModelName}
              />
              <Select
                label={t('admin.imageModels.fields.imageApi')}
                description={t('admin.imageModels.fields.imageApiHint')}
                value={imageApi}
                onChange={(value) => {
                  setImageApi(value as ImageApi | '');
                  setPresetId('');
                }}
              >
                <option value="" disabled>{t('admin.imageModels.fields.imageApiNone')}</option>
                {IMAGE_APIS.map(api => (
                  <option key={api} value={api}>{t(`admin.imageApi.${api}`)}</option>
                ))}
              </Select>
            </Grid>

            <TextArea
              label={t('admin.models.fields.description')}
              value={description}
              onChange={setDescription}
              rows={3}
            />

            <AllowedRolesField value={allowedRoles} onChange={setAllowedRoles} />

            <Field label={t('admin.imageModels.fields.sizePresets')} description={t('admin.imageModels.fields.sizePresetsHint')}>
              <Stack gap="sm">
                {capabilities.sizePresets.map((preset, index) => (
                  <Stack key={index} direction="row" gap="sm" align="end">
                    <TextInput
                      label={t('generate.image.width')}
                      type="number"
                      min={1}
                      value={preset.width}
                      onChange={(value) => updatePreset(index, { ...preset, width: parseInt(value || '0', 10) })}
                    />
                    <TextInput
                      label={t('generate.image.height')}
                      type="number"
                      min={1}
                      value={preset.height}
                      onChange={(value) => updatePreset(index, { ...preset, height: parseInt(value || '0', 10) })}
                    />
                    <IconButton
                      icon="trash"
                      label={t('admin.imageModels.fields.removeSize')}
                      onClick={() => updateCaps('sizePresets', capabilities.sizePresets.filter((_, i) => i !== index))}
                    />
                  </Stack>
                ))}
                <Button
                  variant="dashed"
                  startIcon="add"
                  onClick={() => updateCaps('sizePresets', [...capabilities.sizePresets, { width: 1024, height: 1024 }])}
                >
                  {t('admin.imageModels.fields.addSize')}
                </Button>
              </Stack>
            </Field>

            <CheckboxGroup>
              <Checkbox checked={capabilities.supportsAutoSize} onChange={(checked) => updateCaps('supportsAutoSize', checked)}>
                {t('admin.imageModels.fields.supportsAutoSize')}
              </Checkbox>
              <Checkbox checked={capabilities.supportsCustomSize} onChange={(checked) => updateCaps('supportsCustomSize', checked)}>
                {t('admin.imageModels.fields.supportsCustomSize')}
              </Checkbox>
              <Checkbox checked={capabilities.supportsAutoAspectRatio} onChange={(checked) => updateCaps('supportsAutoAspectRatio', checked)}>
                {t('admin.imageModels.fields.supportsAutoAspectRatio')}
              </Checkbox>
            </CheckboxGroup>

            <Field label={t('admin.imageModels.fields.sizeRules')} description={t('admin.imageModels.fields.sizeRulesHint')}>
              <Grid minColumnWidth="10rem" gap="lg">
                <OptionalNumberInput label={t('admin.imageModels.fields.sizeMultiple')} value={capabilities.sizeMultiple} onChange={(value) => updateCaps('sizeMultiple', value)} />
                <OptionalNumberInput label={t('admin.imageModels.fields.minSide')} value={capabilities.minSide} onChange={(value) => updateCaps('minSide', value)} />
                <OptionalNumberInput label={t('admin.imageModels.fields.maxSide')} value={capabilities.maxSide} onChange={(value) => updateCaps('maxSide', value)} />
                <OptionalNumberInput label={t('admin.imageModels.fields.minPixels')} value={capabilities.minPixels} onChange={(value) => updateCaps('minPixels', value)} />
                <OptionalNumberInput label={t('admin.imageModels.fields.maxPixels')} value={capabilities.maxPixels} onChange={(value) => updateCaps('maxPixels', value)} />
                <OptionalNumberInput label={t('admin.imageModels.fields.maxAspectRatio')} value={capabilities.maxAspectRatio} step="0.1" onChange={(value) => updateCaps('maxAspectRatio', value)} />
              </Grid>
            </Field>

            <Grid minColumnWidth="12rem" gap="lg">
              <TextInput
                label={t('admin.imageModels.fields.maxImagesPerRequest')}
                type="number"
                min={1}
                value={capabilities.maxImagesPerRequest}
                onChange={(value) => updateCaps('maxImagesPerRequest', parseInt(value || '0', 10))}
              />
              <TextInput
                label={t('admin.imageModels.fields.maxPartialImages')}
                description={t('admin.imageModels.fields.maxPartialImagesHint')}
                type="number"
                min={0}
                value={capabilities.maxPartialImages}
                onChange={(value) => updateCaps('maxPartialImages', parseInt(value || '0', 10))}
              />
              <OptionalNumberInput
                label={t('admin.imageModels.fields.maxPromptCharacters')}
                value={capabilities.maxPromptCharacters}
                onChange={(value) => updateCaps('maxPromptCharacters', value)}
              />
            </Grid>

            <Field label={t('admin.imageModels.fields.qualities')} description={t('admin.imageModels.fields.qualitiesHint')}>
              <CheckboxGroup>
                {IMAGE_QUALITIES.map(quality => (
                  <Checkbox
                    key={quality}
                    checked={capabilities.qualities.includes(quality)}
                    onChange={(checked) => updateCaps('qualities', toggled(IMAGE_QUALITIES, capabilities.qualities, quality, checked))}
                  >
                    {t(`generate.image.quality.${quality}`)}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </Field>

            <Field label={t('admin.imageModels.fields.outputFormats')} description={t('admin.imageModels.fields.outputFormatsHint')}>
              <CheckboxGroup>
                {IMAGE_FORMATS.map(format => (
                  <Checkbox
                    key={format}
                    checked={capabilities.outputFormats.includes(format)}
                    onChange={(checked) => updateCaps('outputFormats', toggled(IMAGE_FORMATS, capabilities.outputFormats, format, checked))}
                  >
                    {t(`generate.image.format.${format}`)}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </Field>

            <Checkbox checked={capabilities.supportsCompression} onChange={(checked) => updateCaps('supportsCompression', checked)}>
              {t('admin.imageModels.fields.supportsCompression')}
            </Checkbox>

            <Field label={t('admin.imageModels.fields.backgrounds')} description={t('admin.imageModels.fields.backgroundsHint')}>
              <CheckboxGroup>
                {IMAGE_BACKGROUNDS.map(background => (
                  <Checkbox
                    key={background}
                    checked={capabilities.backgrounds.includes(background)}
                    onChange={(checked) => updateCaps('backgrounds', toggled(IMAGE_BACKGROUNDS, capabilities.backgrounds, background, checked))}
                  >
                    {t(`generate.image.background.${background}`)}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </Field>

            <Field label={t('admin.imageModels.fields.moderationLevels')} description={t('admin.imageModels.fields.moderationLevelsHint')}>
              <CheckboxGroup>
                {IMAGE_MODERATION_LEVELS.map(level => (
                  <Checkbox
                    key={level}
                    checked={capabilities.moderationLevels.includes(level)}
                    onChange={(checked) => updateCaps('moderationLevels', toggled(IMAGE_MODERATION_LEVELS, capabilities.moderationLevels, level, checked))}
                  >
                    {t(`generate.image.moderation.${level}`)}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </Field>

            <Checkbox checked={capabilities.supportsWebGrounding} onChange={(checked) => updateCaps('supportsWebGrounding', checked)}>
              {t('admin.imageModels.fields.supportsWebGrounding')}
            </Checkbox>

            <Stack gap="md">
              <Checkbox
                checked={editing !== null}
                onChange={(checked) => updateCaps('editing', checked ? defaultEditing : null)}
                description={t('admin.imageModels.fields.editingHint')}
              >
                {t('admin.imageModels.fields.editing')}
              </Checkbox>

              {editing && (
                <>
                  <Grid minColumnWidth="12rem" gap="lg">
                    <TextInput
                      label={t('admin.imageModels.fields.maxInputImages')}
                      type="number"
                      min={1}
                      value={editing.maxInputImages}
                      onChange={(value) => updateEditing('maxInputImages', parseInt(value || '0', 10))}
                    />
                    <OptionalNumberInput
                      label={t('admin.imageModels.fields.maxInputImageMegabytes')}
                      value={editing.maxInputImageBytes === null ? null : editing.maxInputImageBytes / BYTES_PER_MEGABYTE}
                      onChange={(value) => updateEditing('maxInputImageBytes', value === null ? null : Math.round(value * BYTES_PER_MEGABYTE))}
                    />
                  </Grid>

                  <Field label={t('admin.imageModels.fields.inputFormats')}>
                    <CheckboxGroup>
                      {IMAGE_FORMATS.map(format => (
                        <Checkbox
                          key={format}
                          checked={editing.inputFormats.includes(format)}
                          onChange={(checked) => updateEditing('inputFormats', toggled(IMAGE_FORMATS, editing.inputFormats, format, checked))}
                        >
                          {t(`generate.image.format.${format}`)}
                        </Checkbox>
                      ))}
                    </CheckboxGroup>
                  </Field>

                  <CheckboxGroup>
                    <Checkbox checked={editing.supportsMask} onChange={(checked) => updateEditing('supportsMask', checked)}>
                      {t('admin.imageModels.fields.supportsMask')}
                    </Checkbox>
                    <Checkbox checked={editing.supportsMarkup} onChange={(checked) => updateEditing('supportsMarkup', checked)}>
                      {t('admin.imageModels.fields.supportsMarkup')}
                    </Checkbox>
                    <Checkbox
                      checked={editing.acceptsGenerationSettings}
                      onChange={(checked) => updateEditing('acceptsGenerationSettings', checked)}
                      description={t('admin.imageModels.fields.acceptsGenerationSettingsHint')}
                    >
                      {t('admin.imageModels.fields.acceptsGenerationSettings')}
                    </Checkbox>
                  </CheckboxGroup>
                </>
              )}
            </Stack>
          </>
        )}
      </Stack>

      {model && <ModelEditorFooter modelId={model.id} dirty={dirty} />}
    </div>
  );
};

export default ImageModelEditor;
