import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { createImageModel, updateImageModel } from '../../services/adminService';
import type { ImageModelDto, EndpointDto } from '../../types/admin';
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
import Select from '../common/Select';
import TextInput from '../common/TextInput';
import NumberField from '../common/NumberField';
import TextArea from '../common/TextArea';
import Checkbox, { CheckboxGroup } from '../common/Checkbox';
import Field from '../common/Field';
import Button from '../common/Button';
import IconButton from '../common/IconButton';
import Stack from '../common/Stack';
import Grid from '../common/Grid';
import { AllowedRolesField } from './ModelEditorParts';
import ModelEditorFrame from './ModelEditorFrame';
import { baseModelForm, useModelEditor } from './modelEditorShared';

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
    ...baseModelForm(model, endpoints),
    // '' until the admin picks one for a new model.
    imageApi: (model?.imageApi ?? '') as ImageApi | '',
    capabilities: model?.capabilities ?? defaultCapabilities,
  };
}

const ImageModelEditor: React.FC<ImageModelEditorProps> = ({ modelId: editId }) => {
  useSignals();
  const { t } = useTranslation();
  const editor = useModelEditor({
    editId,
    type: 'Image',
    isType: isImageModel,
    formFor: formStateFor,
    fromCatalog: (entry) => ({ imageApi: entry.imageApi, capabilities: entry.capabilities }),
  });
  const { model, form, set, setCustom } = editor;
  const { capabilities } = form;
  const editing = capabilities.editing;

  const updateCaps = <K extends keyof ImageModelCapabilities>(key: K, value: ImageModelCapabilities[K]) =>
    setCustom({ capabilities: { ...capabilities, [key]: value } });

  const updateEditing = <K extends keyof ImageEditCapabilities>(key: K, value: ImageEditCapabilities[K]) =>
    updateCaps('editing', { ...(editing ?? defaultEditing), [key]: value });

  const updatePreset = (index: number, size: ImageSize) =>
    updateCaps('sizePresets', capabilities.sizePresets.map((preset, i) => (i === index ? size : preset)));

  const canSave =
    !!form.modelId &&
    !!form.modelName &&
    !!form.description &&
    !!form.endpointId &&
    form.imageApi !== '' &&
    form.allowedRoles.length > 0 &&
    capabilities.maxImagesPerRequest >= 1 &&
    capabilities.outputFormats.length > 0 &&
    capabilities.maxPartialImages >= 0 &&
    (capabilities.sizePresets.length > 0 || capabilities.supportsAutoSize || capabilities.supportsCustomSize) &&
    capabilities.sizePresets.every(s => s.width > 0 && s.height > 0) &&
    (editing === null || (editing.maxInputImages >= 1 && editing.inputFormats.length > 0));

  const handleSave = () => {
    const { imageApi, ...fields } = form;
    if (!canSave || imageApi === '') return;
    const payload = { ...fields, imageApi };
    void editor.save(() => model ? updateImageModel(model.id, payload) : createImageModel(payload));
  };

  return (
    <ModelEditorFrame
      editor={editor}
      title={model ? t('admin.imageModels.editTitle') : t('admin.imageModels.addTitle')}
      canSave={canSave}
      onSave={handleSave}
    >
        <Grid gap="lg">
          <TextInput
            label={t('admin.models.fields.modelName')}
            value={form.modelName}
            onChange={modelName => set({ modelName })}
          />
          <Select
            label={t('admin.imageModels.fields.imageApi')}
            description={t('admin.imageModels.fields.imageApiHint')}
            value={form.imageApi}
            onChange={(value) => setCustom({ imageApi: value as ImageApi | '' })}
          >
            <option value="" disabled>{t('admin.imageModels.fields.imageApiNone')}</option>
            {IMAGE_APIS.map(api => (
              <option key={api} value={api}>{t(`admin.imageApi.${api}`)}</option>
            ))}
          </Select>
        </Grid>

        <TextArea
          label={t('admin.models.fields.description')}
          value={form.description}
          onChange={description => set({ description })}
          rows={3}
        />

        <AllowedRolesField value={form.allowedRoles} onChange={allowedRoles => set({ allowedRoles })} />

        <Field label={t('admin.imageModels.fields.sizePresets')} description={t('admin.imageModels.fields.sizePresetsHint')}>
          <Stack gap="sm">
            {capabilities.sizePresets.map((preset, index) => (
              <Stack key={index} direction="row" gap="sm" align="end">
                <NumberField
                  label={t('generate.image.width')}
                  min={1}
                  value={preset.width}
                  onChange={(value) => updatePreset(index, { ...preset, width: (value ?? 0) })}
                />
                <NumberField
                  label={t('generate.image.height')}
                  min={1}
                  value={preset.height}
                  onChange={(value) => updatePreset(index, { ...preset, height: (value ?? 0) })}
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
          <Grid minColumnWidth="2xs" gap="lg">
            <NumberField min={0} placeholder={t('admin.imageModels.fields.noLimit')} label={t('admin.imageModels.fields.sizeMultiple')} value={capabilities.sizeMultiple} onChange={(value) => updateCaps('sizeMultiple', value)} />
            <NumberField min={0} placeholder={t('admin.imageModels.fields.noLimit')} label={t('admin.imageModels.fields.minSide')} value={capabilities.minSide} onChange={(value) => updateCaps('minSide', value)} />
            <NumberField min={0} placeholder={t('admin.imageModels.fields.noLimit')} label={t('admin.imageModels.fields.maxSide')} value={capabilities.maxSide} onChange={(value) => updateCaps('maxSide', value)} />
            <NumberField min={0} placeholder={t('admin.imageModels.fields.noLimit')} label={t('admin.imageModels.fields.minPixels')} value={capabilities.minPixels} onChange={(value) => updateCaps('minPixels', value)} />
            <NumberField min={0} placeholder={t('admin.imageModels.fields.noLimit')} label={t('admin.imageModels.fields.maxPixels')} value={capabilities.maxPixels} onChange={(value) => updateCaps('maxPixels', value)} />
            <NumberField min={0} placeholder={t('admin.imageModels.fields.noLimit')} label={t('admin.imageModels.fields.maxAspectRatio')} value={capabilities.maxAspectRatio} step={0.01} onChange={(value) => updateCaps('maxAspectRatio', value)} />
          </Grid>
        </Field>

        <Grid gap="lg">
          <NumberField
            label={t('admin.imageModels.fields.maxImagesPerRequest')}
            min={1}
            value={capabilities.maxImagesPerRequest}
            onChange={(value) => updateCaps('maxImagesPerRequest', (value ?? 0))}
          />
          <NumberField
            label={t('admin.imageModels.fields.maxPartialImages')}
            description={t('admin.imageModels.fields.maxPartialImagesHint')}
            min={0}
            value={capabilities.maxPartialImages}
            onChange={(value) => updateCaps('maxPartialImages', (value ?? 0))}
          />
          <NumberField
            label={t('admin.imageModels.fields.maxPromptCharacters')}
            min={0}
            placeholder={t('admin.imageModels.fields.noLimit')}
            value={capabilities.maxPromptCharacters}
            onChange={(value) => updateCaps('maxPromptCharacters', value)}
          />
        </Grid>

        <Field label={t('admin.imageModels.fields.qualities')} description={t('admin.imageModels.fields.qualitiesHint')}>
          <CheckboxGroup value={capabilities.qualities} onChange={value => updateCaps('qualities', value as typeof capabilities.qualities)}>
            {IMAGE_QUALITIES.map(quality => (
              <Checkbox key={quality} value={quality}>{t(`generate.image.quality.${quality}`)}</Checkbox>
            ))}
          </CheckboxGroup>
        </Field>

        <Field label={t('admin.imageModels.fields.outputFormats')} description={t('admin.imageModels.fields.outputFormatsHint')}>
          <CheckboxGroup value={capabilities.outputFormats} onChange={value => updateCaps('outputFormats', value as typeof capabilities.outputFormats)}>
            {IMAGE_FORMATS.map(format => (
              <Checkbox key={format} value={format}>{t(`generate.image.format.${format}`)}</Checkbox>
            ))}
          </CheckboxGroup>
        </Field>

        <Checkbox checked={capabilities.supportsCompression} onChange={(checked) => updateCaps('supportsCompression', checked)}>
          {t('admin.imageModels.fields.supportsCompression')}
        </Checkbox>

        <Field label={t('admin.imageModels.fields.backgrounds')} description={t('admin.imageModels.fields.backgroundsHint')}>
          <CheckboxGroup value={capabilities.backgrounds} onChange={value => updateCaps('backgrounds', value as typeof capabilities.backgrounds)}>
            {IMAGE_BACKGROUNDS.map(background => (
              <Checkbox key={background} value={background}>{t(`generate.image.background.${background}`)}</Checkbox>
            ))}
          </CheckboxGroup>
        </Field>

        <Field label={t('admin.imageModels.fields.moderationLevels')} description={t('admin.imageModels.fields.moderationLevelsHint')}>
          <CheckboxGroup value={capabilities.moderationLevels} onChange={value => updateCaps('moderationLevels', value as typeof capabilities.moderationLevels)}>
            {IMAGE_MODERATION_LEVELS.map(level => (
              <Checkbox key={level} value={level}>{t(`generate.image.moderation.${level}`)}</Checkbox>
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
              <Grid gap="lg">
                <NumberField
                  label={t('admin.imageModels.fields.maxInputImages')}
                  min={1}
                  value={editing.maxInputImages}
                  onChange={(value) => updateEditing('maxInputImages', (value ?? 0))}
                />
                <NumberField
                  label={t('admin.imageModels.fields.maxInputImageMegabytes')}
                  min={0}
                  step={0.01}
                  placeholder={t('admin.imageModels.fields.noLimit')}
                  value={editing.maxInputImageBytes === null ? null : editing.maxInputImageBytes / BYTES_PER_MEGABYTE}
                  onChange={(value) => updateEditing('maxInputImageBytes', value === null ? null : Math.round(value * BYTES_PER_MEGABYTE))}
                />
              </Grid>

              <Field label={t('admin.imageModels.fields.inputFormats')}>
                <CheckboxGroup value={editing.inputFormats} onChange={value => updateEditing('inputFormats', value as typeof editing.inputFormats)}>
                  {IMAGE_FORMATS.map(format => (
                    <Checkbox key={format} value={format}>{t(`generate.image.format.${format}`)}</Checkbox>
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
    </ModelEditorFrame>
  );
};

export default ImageModelEditor;
