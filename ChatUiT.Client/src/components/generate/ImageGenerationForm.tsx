import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ImageBackground,
  ImageFormat,
  ImageModeration,
  ImageQuality,
  UserImageModelDto,
} from '../../types/modelModels';
import type { ImageGenerationRequest } from '../../types/mediaGenerationModels';
import { refineImagePrompt, startImageGeneration } from '../../services/mediaGenerationService';
import Select from '../common/Select';
import TextInput from '../common/TextInput';
import TextArea from '../common/TextArea';
import Checkbox from '../common/Checkbox';
import Field from '../common/Field';
import Button from '../common/Button';
import IconButton from '../common/IconButton';
import Stack from '../common/Stack';
import Grid from '../common/Grid';
import { allowsTransparency, customSizeProblems, fileProblem, sideRange, type RuleProblem } from './imageFormRules';

const AUTO_SIZE = 'auto';
const CUSTOM_SIZE = 'custom';
const MAX_COMPRESSION = 100;

/** The value of a size option: a preset as "WxH", or AUTO_SIZE or CUSTOM_SIZE. */
const presetValue = (width: number, height: number) => `${width}x${height}`;

/** The size the form starts on: auto when the model offers it, else its first preset, else a custom size. */
function initialSize(model: UserImageModelDto): string {
  const caps = model.capabilities;
  if (caps.supportsAutoSize) return AUTO_SIZE;
  if (caps.sizePresets.length > 0) return presetValue(caps.sizePresets[0].width, caps.sizePresets[0].height);
  return CUSTOM_SIZE;
}

/** A file picker that lists the chosen files with a remove button each. */
const FilePicker: React.FC<{
  label: string;
  description: string;
  error?: string;
  files: File[];
  multiple: boolean;
  accept: string;
  onChange: (files: File[]) => void;
}> = ({ label, description, error, files, multiple, accept, onChange }) => {
  const { t } = useTranslation();
  return (
    <Field label={label} description={description} error={error}>
      <Stack gap="xs">
        {files.map((file, index) => (
          <Stack key={`${file.name}-${index}`} direction="row" gap="sm" align="center">
            <span className="t-body generate-file-name">{file.name}</span>
            <IconButton icon="close" size="small" label={t('generate.remove')} onClick={() => onChange(files.filter((_, i) => i !== index))} />
          </Stack>
        ))}
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
            event.target.value = '';
          }}
        />
      </Stack>
    </Field>
  );
};

interface ImageGenerationFormProps {
  models: UserImageModelDto[];
}

/** The form for one image generation or edit. Every control follows what the chosen model supports. */
const ImageGenerationForm: React.FC<ImageGenerationFormProps> = ({ models }) => {
  const { t } = useTranslation();
  const [modelId, setModelId] = useState(models[0]?.id ?? '');
  const model = models.find(m => m.id === modelId) ?? models[0];
  const caps = model.capabilities;

  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState(initialSize(model));
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(1024);
  const [autoAspectRatio, setAutoAspectRatio] = useState(false);
  const [quality, setQuality] = useState<ImageQuality | ''>('');
  const [count, setCount] = useState(1);
  const [outputFormat, setOutputFormat] = useState<ImageFormat | ''>('');
  const [compression, setCompression] = useState<number | ''>('');
  const [background, setBackground] = useState<ImageBackground | ''>('');
  const [moderation, setModeration] = useState<ImageModeration | ''>('');
  const [partialImages, setPartialImages] = useState(0);
  const [webGrounding, setWebGrounding] = useState(false);
  const [inputImages, setInputImages] = useState<File[]>([]);
  const [mask, setMask] = useState<File[]>([]);
  const [markup, setMarkup] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [refining, setRefining] = useState(false);
  // The prompt as it was before the last refinement, until the user edits the refined one
  const [unrefinedPrompt, setUnrefinedPrompt] = useState<string | null>(null);

  // Settings the new model does not offer are reset when the model changes
  const [syncedModelId, setSyncedModelId] = useState(model.id);
  if (model.id !== syncedModelId) {
    setSyncedModelId(model.id);
    setSize(initialSize(model));
    setAutoAspectRatio(false);
    setQuality('');
    setCount(1);
    setOutputFormat('');
    setCompression('');
    setBackground('');
    setModeration('');
    setPartialImages(0);
    setWebGrounding(false);
    setInputImages([]);
    setMask([]);
    setMarkup([]);
  }

  const editing = caps.editing;
  const isEdit = inputImages.length > 0;
  // An edit on a model that takes only the prompt and the images hides the other settings
  const showSettings = !isEdit || (editing?.acceptsGenerationSettings ?? false);
  const effectiveFormat = outputFormat || caps.outputFormats[0];
  const showCompression = caps.supportsCompression && (effectiveFormat === 'Jpeg' || effectiveFormat === 'Webp');
  const acceptedInputs = (editing?.inputFormats ?? []).map(f => `image/${f.toLowerCase()}`).join(',');
  const promptTooLong = caps.maxPromptCharacters !== null && prompt.length > caps.maxPromptCharacters;

  // Combinations the model refuses are not offered: partial images stream one image only, and a
  // transparent background needs PNG or WebP.
  const formatOptions = background === 'Transparent' ? caps.outputFormats.filter(allowsTransparency) : caps.outputFormats;
  const offersDefaultFormat = background !== 'Transparent' || allowsTransparency(caps.outputFormats[0]);
  const backgroundOptions = allowsTransparency(effectiveFormat) ? caps.backgrounds : caps.backgrounds.filter(b => b !== 'Transparent');

  const ruleText = (problem: RuleProblem) => t(`generate.image.rules.${problem.key}`, problem.values);
  const sides = sideRange(caps);
  const sizeProblems = showSettings && size === CUSTOM_SIZE ? customSizeProblems(caps, customWidth, customHeight) : [];
  const inputProblems = editing ? inputImages.map(f => fileProblem(f, editing.inputFormats, editing.maxInputImageBytes)).filter(p => p !== null) : [];
  const overlayProblems = isEdit ? [...mask, ...markup].map(f => fileProblem(f, ['Png'], editing?.maxInputImageBytes ?? null)).filter(p => p !== null) : [];
  const canSubmit = !!prompt.trim() && !promptTooLong && sizeProblems.length === 0 && inputProblems.length === 0 && overlayProblems.length === 0 && !submitting && !refining;

  const editPrompt = (value: string) => {
    setPrompt(value);
    setUnrefinedPrompt(null);
  };

  const handleRefine = async () => {
    setRefining(true);
    try {
      const refined = await refineImagePrompt(model.id, { prompt, isEdit });
      setUnrefinedPrompt(prompt);
      setPrompt(refined);
    } catch (error) {
      // The server's reason has already been shown as a toast.
      console.error('Failed to refine the prompt:', error);
    } finally {
      setRefining(false);
    }
  };

  const undoRefine = () => {
    if (unrefinedPrompt === null) return;
    setPrompt(unrefinedPrompt);
    setUnrefinedPrompt(null);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const request: ImageGenerationRequest = {
        prompt,
        size: !showSettings || size === AUTO_SIZE
          ? null
          : size === CUSTOM_SIZE
            ? { width: customWidth, height: customHeight }
            : { width: Number(size.split('x')[0]), height: Number(size.split('x')[1]) },
        autoAspectRatio: showSettings && autoAspectRatio,
        quality: showSettings && quality ? quality : null,
        count: showSettings ? count : 1,
        outputFormat: showSettings && outputFormat ? outputFormat : null,
        compression: showSettings && showCompression && compression !== '' ? compression : null,
        background: showSettings && background ? background : null,
        moderation: !isEdit && moderation ? moderation : null,
        partialImages: showSettings ? partialImages : 0,
        webGrounding: showSettings && webGrounding,
      };
      await startImageGeneration(model.id, request, {
        inputImages,
        mask: isEdit ? mask[0] ?? null : null,
        markup: isEdit ? markup[0] ?? null : null,
      });
    } catch (error) {
      // The server's reason has already been shown as a toast.
      console.error('Failed to start image generation:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap="lg">
      <Select label={t('generate.model')} description={model.description} value={model.id} onChange={setModelId}>
        {models.map(m => (
          <option key={m.id} value={m.id}>{m.modelName}</option>
        ))}
      </Select>

      <Stack gap="sm">
        <TextArea
          label={t('generate.prompt')}
          description={caps.maxPromptCharacters !== null ? t('generate.promptCount', { count: prompt.length, max: caps.maxPromptCharacters }) : undefined}
          error={promptTooLong ? t('generate.promptTooLong', { max: caps.maxPromptCharacters }) : undefined}
          placeholder={t('generate.promptPlaceholder')}
          value={prompt}
          onChange={editPrompt}
          rows={4}
          disabled={refining}
        />
        <Stack direction="row" gap="xs" wrap>
          <Button variant="ghost" size="small" startIcon="edit" onClick={handleRefine} disabled={!prompt.trim() || submitting} loading={refining}>
            {t('generate.refinePrompt')}
          </Button>
          {unrefinedPrompt !== null && (
            <Button variant="ghost" size="small" startIcon="back" onClick={undoRefine}>
              {t('generate.undoRefine')}
            </Button>
          )}
        </Stack>
      </Stack>

      {editing && (
        <FilePicker
          label={t('generate.image.inputImages')}
          description={t('generate.image.inputImagesHint', { max: editing.maxInputImages })}
          error={inputProblems.length > 0 ? inputProblems.map(ruleText).join(' ') : undefined}
          files={inputImages}
          multiple={editing.maxInputImages > 1}
          accept={acceptedInputs}
          onChange={(files) => setInputImages(files.slice(0, editing.maxInputImages))}
        />
      )}

      {isEdit && editing?.supportsMask && markup.length === 0 && (
        <FilePicker
          label={t('generate.image.mask')}
          description={t('generate.image.maskHint')}
          error={mask.length > 0 && overlayProblems.length > 0 ? overlayProblems.map(ruleText).join(' ') : undefined}
          files={mask}
          multiple={false}
          accept="image/png"
          onChange={setMask}
        />
      )}

      {isEdit && editing?.supportsMarkup && mask.length === 0 && (
        <FilePicker
          label={t('generate.image.markup')}
          description={t('generate.image.markupHint')}
          error={markup.length > 0 && overlayProblems.length > 0 ? overlayProblems.map(ruleText).join(' ') : undefined}
          files={markup}
          multiple={false}
          accept="image/png"
          onChange={setMarkup}
        />
      )}

      {isEdit && !showSettings && (
        <p className="t-caption">{t('generate.image.editTakesPromptOnly')}</p>
      )}

      {showSettings && (
        <>
          <Grid minColumnWidth="12rem" gap="lg">
            <Select label={t('generate.image.size')} value={size} onChange={setSize}>
              {caps.supportsAutoSize && <option value={AUTO_SIZE}>{t('generate.image.sizeAuto')}</option>}
              {caps.sizePresets.map(preset => (
                <option key={presetValue(preset.width, preset.height)} value={presetValue(preset.width, preset.height)}>
                  {preset.width} × {preset.height}
                </option>
              ))}
              {caps.supportsCustomSize && <option value={CUSTOM_SIZE}>{t('generate.image.sizeCustom')}</option>}
            </Select>

            {size === CUSTOM_SIZE && (
              <>
                <TextInput
                  label={t('generate.image.width')}
                  type="number"
                  min={sides.min}
                  max={sides.max}
                  step={sides.step}
                  invalid={sizeProblems.length > 0}
                  error={sizeProblems.length > 0 ? sizeProblems.map(ruleText).join(' ') : undefined}
                  value={customWidth}
                  onChange={(value) => setCustomWidth(parseInt(value || '0', 10))}
                />
                <TextInput
                  label={t('generate.image.height')}
                  type="number"
                  min={sides.min}
                  max={sides.max}
                  step={sides.step}
                  invalid={sizeProblems.length > 0}
                  value={customHeight}
                  onChange={(value) => setCustomHeight(parseInt(value || '0', 10))}
                />
              </>
            )}

            {caps.qualities.length > 0 && (
              <Select label={t('generate.image.qualityLabel')} value={quality} onChange={(value) => setQuality(value as ImageQuality | '')}>
                <option value="">{t('generate.modelDefault')}</option>
                {caps.qualities.map(q => (
                  <option key={q} value={q}>{t(`generate.image.quality.${q}`)}</option>
                ))}
              </Select>
            )}

            {caps.maxImagesPerRequest > 1 && (
              <TextInput
                label={t('generate.image.count')}
                description={partialImages > 0 ? t('generate.image.rules.countNeedsNoPreviews') : undefined}
                type="number"
                min={1}
                max={caps.maxImagesPerRequest}
                disabled={partialImages > 0}
                value={count}
                onChange={(value) => setCount(Math.min(caps.maxImagesPerRequest, Math.max(1, parseInt(value || '1', 10))))}
              />
            )}

            {caps.outputFormats.length > 1 && (
              <Select
                label={t('generate.image.formatLabel')}
                description={background === 'Transparent' ? t('generate.image.rules.transparentNeedsFormat') : undefined}
                value={outputFormat}
                onChange={(value) => setOutputFormat(value as ImageFormat | '')}
              >
                {offersDefaultFormat && <option value="">{t('generate.modelDefault')}</option>}
                {formatOptions.map(f => (
                  <option key={f} value={f}>{t(`generate.image.format.${f}`)}</option>
                ))}
              </Select>
            )}

            {showCompression && (
              <TextInput
                label={t('generate.image.compression')}
                type="number"
                min={0}
                max={MAX_COMPRESSION}
                placeholder={t('generate.modelDefault')}
                value={compression}
                onChange={(value) => setCompression(value === '' ? '' : Math.min(MAX_COMPRESSION, Math.max(0, parseInt(value, 10))))}
              />
            )}

            {caps.backgrounds.length > 0 && (
              <Select
                label={t('generate.image.backgroundLabel')}
                description={backgroundOptions.length < caps.backgrounds.length ? t('generate.image.rules.transparentNeedsFormat') : undefined}
                value={background}
                onChange={(value) => setBackground(value as ImageBackground | '')}
              >
                <option value="">{t('generate.modelDefault')}</option>
                {backgroundOptions.map(b => (
                  <option key={b} value={b}>{t(`generate.image.background.${b}`)}</option>
                ))}
              </Select>
            )}

            {!isEdit && caps.moderationLevels.length > 0 && (
              <Select label={t('generate.image.moderationLabel')} value={moderation} onChange={(value) => setModeration(value as ImageModeration | '')}>
                <option value="">{t('generate.modelDefault')}</option>
                {caps.moderationLevels.map(m => (
                  <option key={m} value={m}>{t(`generate.image.moderation.${m}`)}</option>
                ))}
              </Select>
            )}

            {caps.maxPartialImages > 0 && (
              <TextInput
                label={t('generate.image.partialImages')}
                description={count > 1 ? t('generate.image.rules.previewsNeedOneImage') : t('generate.image.partialImagesHint')}
                type="number"
                min={0}
                max={caps.maxPartialImages}
                disabled={count > 1}
                value={partialImages}
                onChange={(value) => setPartialImages(Math.min(caps.maxPartialImages, Math.max(0, parseInt(value || '0', 10))))}
              />
            )}
          </Grid>

          {caps.supportsAutoAspectRatio && (
            <Checkbox checked={autoAspectRatio} onChange={setAutoAspectRatio} description={t('generate.image.autoAspectRatioHint')}>
              {t('generate.image.autoAspectRatio')}
            </Checkbox>
          )}

          {caps.supportsWebGrounding && (
            <Checkbox checked={webGrounding} onChange={setWebGrounding} description={t('generate.image.webGroundingHint')}>
              {t('generate.image.webGrounding')}
            </Checkbox>
          )}
        </>
      )}

      <div>
        <Button variant="primary" startIcon="image" onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
          {isEdit ? t('generate.image.edit') : t('generate.image.generate')}
        </Button>
      </div>
    </Stack>
  );
};

export default ImageGenerationForm;
