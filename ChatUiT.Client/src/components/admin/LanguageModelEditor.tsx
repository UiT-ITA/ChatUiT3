import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { createLanguageModel, updateLanguageModel } from '../../services/adminService';
import type {
  LanguageModelCapabilities,
  TemperatureSupport,
  ReasoningEffortLevel,
  ApiProtocol,
  LanguageModelDto,
  EndpointDto,
} from '../../types/admin';
import { API_PROTOCOLS, REASONING_EFFORT_ORDER, TOKEN_COUNTING_SCHEME_OPTIONS, isLanguageModel } from '../../types/admin';
import { DATA_CLASSIFICATIONS, type DataClassification } from '../../types/modelModels';
import Select from '../common/Select';
import TextInput from '../common/TextInput';
import NumberField from '../common/NumberField';
import TextArea from '../common/TextArea';
import Checkbox, { CheckboxGroup } from '../common/Checkbox';
import Field from '../common/Field';
import Stack from '../common/Stack';
import Grid from '../common/Grid';
import Text from '../common/Text';
import { AllowedRolesField } from './ModelEditorParts';
import ModelEditorFrame from './ModelEditorFrame';
import { baseModelForm, useModelEditor } from './modelEditorShared';

const TEMPERATURE_OPTIONS: TemperatureSupport[] = [
  'Unsupported',
  'Supported',
  'SupportedWhenReasoningDisabled',
];

const defaultCapabilities: LanguageModelCapabilities = {
  supportsVision: false,
  supportsFunctionCalling: false,
  temperature: 'Unsupported',
  supportedEfforts: [],
  maxContextTokens: 16000,
  maxOutputTokens: 16000,
  defaultMaxOutputTokens: 16000,
  knowledgeCutoff: null,
  tokenCountingScheme: null,
};

interface LanguageModelEditorProps {
  modelId?: string;
}

/** The month input's value for a knowledge cutoff date, or '' for none. */
const cutoffMonth = (iso: string | null | undefined) => typeof iso === 'string' && iso.length >= 7 ? iso.slice(0, 7) : '';

/** The form's field values for a model, or the defaults for a new one. */
function formStateFor(model: LanguageModelDto | undefined, endpoints: EndpointDto[]) {
  const caps = model?.capabilities ?? defaultCapabilities;
  return {
    ...baseModelForm(model, endpoints),
    // A new model starts ticked; an admin unticks it for models too expensive to run unprompted.
    allowedAsDefault: model?.allowedAsDefault ?? true,
    exposedInApi: model?.exposedInApi ?? false,
    // '' until the admin picks one for a new model.
    apiProtocol: (model?.apiProtocol ?? '') as ApiProtocol | '',
    classification: model?.classification ?? 'Green' as DataClassification,
    capabilities: caps,
    knowledgeCutoffMonth: cutoffMonth(caps.knowledgeCutoff),
  };
}

const LanguageModelEditor: React.FC<LanguageModelEditorProps> = ({ modelId: editId }) => {
  useSignals();
  const { t } = useTranslation();
  const editor = useModelEditor({
    editId,
    type: 'Language',
    isType: isLanguageModel,
    formFor: formStateFor,
    fromCatalog: (entry) => ({ apiProtocol: entry.apiProtocol, capabilities: entry.capabilities, knowledgeCutoffMonth: cutoffMonth(entry.capabilities.knowledgeCutoff) }),
  });
  const { model, form, set, setCustom } = editor;
  const { capabilities } = form;

  const updateCaps = <K extends keyof LanguageModelCapabilities>(key: K, value: LanguageModelCapabilities[K]) =>
    setCustom({ capabilities: { ...capabilities, [key]: value } });

  const canSave =
    !!form.modelId &&
    !!form.modelName &&
    !!form.description &&
    !!form.endpointId &&
    form.apiProtocol !== '' &&
    // AllowedRoles is enforced, so a model saved with no roles would be invisible to
    // everyone with nothing to explain why.
    form.allowedRoles.length > 0 &&
    Number(capabilities.maxContextTokens) > 0 &&
    Number(capabilities.maxOutputTokens) > 0 &&
    Number(capabilities.defaultMaxOutputTokens) > 0 &&
    Number(capabilities.defaultMaxOutputTokens) <= Number(capabilities.maxOutputTokens);

  const handleSave = () => {
    const { knowledgeCutoffMonth, apiProtocol, ...fields } = form;
    if (!canSave || apiProtocol === '') return;
    const payload = {
      ...fields,
      apiProtocol,
      capabilities: {
        ...capabilities,
        knowledgeCutoff: knowledgeCutoffMonth ? `${knowledgeCutoffMonth}-01T00:00:00Z` : null,
        tokenCountingScheme: capabilities.tokenCountingScheme?.trim() || null,
      },
    };
    void editor.save(() => model ? updateLanguageModel(model.id, payload) : createLanguageModel(payload));
  };

  return (
    <ModelEditorFrame
      editor={editor}
      title={model ? t('admin.models.dialog.edit.title') : t('admin.models.add.title')}
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
            label={t('admin.models.fields.apiProtocol')}
            description={form.apiProtocol === '' ? t('admin.models.fields.apiProtocolRequired') : t('admin.models.fields.apiProtocolHint')}
            value={form.apiProtocol}
            onChange={(value) => setCustom({ apiProtocol: value as ApiProtocol | '' })}
          >
            <option value="" disabled>{t('admin.models.fields.apiProtocolNone')}</option>
            {API_PROTOCOLS.map(protocol => (
              <option key={protocol} value={protocol}>{t(`admin.apiProtocol.${protocol}`)}</option>
            ))}
          </Select>
        </Grid>

        <TextArea
          label={t('admin.models.fields.description')}
          value={form.description}
          onChange={description => set({ description })}
          rows={3}
        />

        <Select
          label={t('admin.models.fields.classification')}
          value={form.classification}
          onChange={(value) => set({ classification: value as DataClassification })}
        >
          {DATA_CLASSIFICATIONS.map(level => (
            <option key={level} value={level}>{t(`classification.${level}`)}</option>
          ))}
        </Select>

        <AllowedRolesField value={form.allowedRoles} onChange={allowedRoles => set({ allowedRoles })} />

        <Checkbox checked={form.allowedAsDefault} onChange={allowedAsDefault => set({ allowedAsDefault })} description={t('admin.models.fields.allowedAsDefaultHelp')}>
          {t('admin.models.fields.allowedAsDefault')}
        </Checkbox>

        <Checkbox checked={form.exposedInApi} onChange={exposedInApi => set({ exposedInApi })} description={t('admin.models.fields.exposedInApiHelp')}>
          {t('admin.models.fields.exposedInApi')}
        </Checkbox>

        <Stack gap="sm">
          <Text as="div" variant="overline">{t('admin.models.fields.capabilities')}</Text>
          <CheckboxGroup>
            <Checkbox
              checked={capabilities.supportsVision}
              onChange={(checked) => updateCaps('supportsVision', checked)}
            >
              {t('admin.models.fields.supportsVision')}
            </Checkbox>
            <Checkbox
              checked={capabilities.supportsFunctionCalling}
              onChange={(checked) => updateCaps('supportsFunctionCalling', checked)}
            >
              {t('admin.models.fields.supportsFunctionCalling')}
            </Checkbox>
          </CheckboxGroup>
        </Stack>

        <Select
          label={t('admin.models.fields.temperature')}
          description={t('admin.models.fields.temperatureHint')}
          value={capabilities.temperature}
          onChange={(value) => updateCaps('temperature', value as TemperatureSupport)}
        >
          {TEMPERATURE_OPTIONS.map(option => (
            <option key={option} value={option}>
              {t(`admin.models.temperatureSupport.${option}`)}
            </option>
          ))}
        </Select>

        <Field label={t('admin.models.fields.supportedEfforts')} description={t('admin.models.fields.supportedEffortsHint')}>
          <CheckboxGroup
            value={capabilities.supportedEfforts}
            onChange={value => updateCaps('supportedEfforts', value as ReasoningEffortLevel[])}
          >
            {REASONING_EFFORT_ORDER.map(level => (
              <Checkbox key={level} value={level}>{t(`assistants.form.reasoningLevels.${level.toLowerCase()}`)}</Checkbox>
            ))}
          </CheckboxGroup>
        </Field>

        <Grid gap="lg">
          <NumberField
            label={t('admin.models.fields.maxContextTokens')}
            min={1}
            value={capabilities.maxContextTokens}
            onChange={(value) => updateCaps('maxContextTokens', (value ?? 0))}
          />
          <NumberField
            label={t('admin.models.fields.maxOutputTokens')}
            min={1}
            value={capabilities.maxOutputTokens}
            onChange={(value) => updateCaps('maxOutputTokens', (value ?? 0))}
          />
          <NumberField
            label={t('admin.models.fields.defaultMaxOutputTokens')}
            min={1}
            max={capabilities.maxOutputTokens || undefined}
            value={capabilities.defaultMaxOutputTokens}
            onChange={(value) => updateCaps('defaultMaxOutputTokens', (value ?? 0))}
          />
          <TextInput
            label={t('admin.models.fields.knowledgeCutoff')}
            type="month"
            value={form.knowledgeCutoffMonth}
            onChange={(value) => setCustom({ knowledgeCutoffMonth: value })}
          />
          <Select
            label={t('admin.models.fields.tokenCountingScheme')}
            description={(() => {
              const selected = TOKEN_COUNTING_SCHEME_OPTIONS.find(o => o.id === capabilities.tokenCountingScheme);
              if (selected) return t(`admin.tokenCountingSchemes.${selected.labelKey}.hint`);
              return capabilities.tokenCountingScheme
                ? t('admin.models.fields.tokenCountingSchemeCustom')
                : t('admin.models.fields.tokenCountingSchemeHint');
            })()}
            value={capabilities.tokenCountingScheme ?? ''}
            onChange={(value) => updateCaps('tokenCountingScheme', value || null)}
          >
            <option value="">{t('admin.models.fields.tokenCountingSchemeNone')}</option>
            {/* The fit is in the label because browsers show no tooltip for options in an open list. */}
            {TOKEN_COUNTING_SCHEME_OPTIONS.map(option => (
              <option key={option.id} value={option.id} title={t(`admin.tokenCountingSchemes.${option.labelKey}.hint`)}>
                {t(`admin.tokenCountingSchemes.${option.labelKey}.label`)}
              </option>
            ))}
            {/* A hand-entered variant such as "o200k-tile-70-140" on an existing row stays selectable. */}
            {capabilities.tokenCountingScheme && !TOKEN_COUNTING_SCHEME_OPTIONS.some(o => o.id === capabilities.tokenCountingScheme) && (
              <option value={capabilities.tokenCountingScheme}>{capabilities.tokenCountingScheme}</option>
            )}
          </Select>
        </Grid>
    </ModelEditorFrame>
  );
};

export default LanguageModelEditor;
