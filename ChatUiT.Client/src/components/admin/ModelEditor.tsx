import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { createModel, updateModel, deleteModel, getModelCatalog, getEndpointDeployments, testModel } from '../../services/adminService';
import { adminEndpointsSignal, adminModelsSignal, loadAdminData } from '../../services/adminDataService';
import type {
  UserRole,
  ModelCapabilities,
  TemperatureSupport,
  ReasoningEffortLevel,
  CatalogModelDto,
  ApiProtocol,
  ModelDto,
  EndpointDto,
  EndpointDeploymentDto,
  ModelTestResultDto,
} from '../../types/admin';
import { API_PROTOCOLS, REASONING_EFFORT_ORDER, TOKEN_COUNTING_SCHEME_OPTIONS } from '../../types/admin';
import { DATA_CLASSIFICATIONS, type DataClassification } from '../../types/modelModels';
import EditorHeader from '../layout/EditorHeader';
import { Icon } from '../common/Icon';
import Select from '../common/Select';
import TextInput from '../common/TextInput';
import TextArea from '../common/TextArea';
import Checkbox, { CheckboxGroup } from '../common/Checkbox';
import Field from '../common/Field';
import Button from '../common/Button';
import Stack from '../common/Stack';
import Grid from '../common/Grid';
import { hasChanges } from '../../utils/formChanges';
import ModelCombobox, { type ModelComboboxOption } from './ModelCombobox';

const ALL_ROLES: UserRole[] = ['User', 'Admin', 'Beta', 'Super', 'External'];

const TEMPERATURE_OPTIONS: TemperatureSupport[] = [
  'Unsupported',
  'Supported',
  'SupportedWhenReasoningDisabled',
];

const defaultCapabilities: ModelCapabilities = {
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

interface ModelEditorProps {
  modelId?: string;
}

/** The form's field values for a model, or the defaults for a new one. */
function formStateFor(model: ModelDto | undefined, endpoints: EndpointDto[]) {
  const caps = model?.capabilities ?? defaultCapabilities;
  const iso = caps.knowledgeCutoff;
  return {
    modelId: model?.modelId ?? '',
    modelName: model?.modelName ?? '',
    description: model?.description ?? '',
    // A new model starts on the first endpoint. An existing model whose endpoint was deleted starts empty, so the admin must pick one.
    endpointId: model
      ? (endpoints.some(ep => ep.id === model.endpointId) ? model.endpointId : '')
      : (endpoints[0]?.id ?? ''),
    // A new model is available to everyone; an existing one keeps exactly the roles
    // it was saved with, so opening the form can never widen access on its own.
    allowedRoles: model ? (model.allowedRoles ?? []) : [...ALL_ROLES],
    // A new model starts ticked; an admin unticks it for models too expensive to run unprompted.
    allowedAsDefault: model?.allowedAsDefault ?? true,
    exposedInApi: model?.exposedInApi ?? false,
    apiProtocol: (model?.apiProtocol ?? '') as ApiProtocol | '',
    classification: model?.classification ?? 'Green' as DataClassification,
    capabilities: caps,
    knowledgeCutoffMonth: typeof iso === 'string' && iso.length >= 7 ? iso.slice(0, 7) : '',
  };
}

const ModelEditor: React.FC<ModelEditorProps> = ({ modelId: editId }) => {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const models = adminModelsSignal.value;
  const endpoints = adminEndpointsSignal.value ?? [];
  const model = editId ? models?.find(m => m.id === editId) : undefined;

  const initial = formStateFor(model, endpoints);
  const [modelId, setModelId] = useState(initial.modelId);
  const [modelName, setModelName] = useState(initial.modelName);
  const [description, setDescription] = useState(initial.description);
  const [endpointId, setEndpointId] = useState(initial.endpointId);
  const [allowedRoles, setAllowedRoles] = useState<UserRole[]>(initial.allowedRoles);
  const [allowedAsDefault, setAllowedAsDefault] = useState(initial.allowedAsDefault);
  const [exposedInApi, setExposedInApi] = useState(initial.exposedInApi);
  // '' until the admin picks one; a stored row from before per-model protocols also arrives as ''.
  const [apiProtocol, setApiProtocol] = useState<ApiProtocol | ''>(initial.apiProtocol);
  const [classification, setClassification] = useState<DataClassification>(initial.classification);
  const [capabilities, setCapabilities] = useState<ModelCapabilities>(initial.capabilities);
  const [knowledgeCutoffMonth, setKnowledgeCutoffMonth] = useState<string>(initial.knowledgeCutoffMonth);
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<CatalogModelDto[]>([]);
  // The catalog entry last applied, or '' for custom values
  const [presetId, setPresetId] = useState('');
  // The deployments listed for endpointId; empty when the endpoint cannot list them
  const [deployments, setDeployments] = useState<{ endpointId: string; items: EndpointDeploymentDto[] }>({ endpointId: '', items: [] });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ModelTestResultDto | null>(null);

  useEffect(() => {
    loadAdminData();
    // A failed catalog fetch must not block the form — it only prefills.
    getModelCatalog().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (!endpointId) return;
    let cancelled = false;
    getEndpointDeployments(endpointId)
      .then(items => { if (!cancelled) setDeployments({ endpointId, items }); })
      .catch(() => { if (!cancelled) setDeployments({ endpointId, items: [] }); });
    return () => { cancelled = true; };
  }, [endpointId]);

  const deploymentsLoaded = deployments.endpointId === endpointId;
  const endpointDeployments = deploymentsLoaded ? deployments.items : [];
  const endpointType = endpoints.find(ep => ep.id === endpointId)?.endpointType;
  // The endpoint's deployments, or the presets for its type when it lists none.
  const modelOptions: ModelComboboxOption[] = (!deploymentsLoaded
    ? []
    : endpointDeployments.length > 0
      ? endpointDeployments.map(d => ({ value: d.name, detail: d.model !== d.name ? d.model : undefined }))
      : catalog.filter(c => c.provider === endpointType).map(c => ({ value: c.modelId, detail: c.displayName }))
  ).map(o => ({ ...o, added: models?.some(m => m.endpointId === endpointId && m.modelId.toLowerCase() === o.value.toLowerCase()) ?? false }));

  const [synced, setSynced] = useState({ model, endpointCount: endpoints.length });
  if (model !== synced.model || endpoints.length !== synced.endpointCount) {
    setSynced({ model, endpointCount: endpoints.length });
    const next = formStateFor(model, endpoints);
    setModelId(next.modelId);
    setModelName(next.modelName);
    setDescription(next.description);
    setEndpointId(next.endpointId);
    setAllowedRoles(next.allowedRoles);
    setAllowedAsDefault(next.allowedAsDefault);
    setExposedInApi(next.exposedInApi);
    setApiProtocol(next.apiProtocol);
    setClassification(next.classification);
    setCapabilities(next.capabilities);
    setKnowledgeCutoffMonth(next.knowledgeCutoffMonth);
    setPresetId('');
    setTestResult(null);
  }

  if (editId && models === undefined) {
    return <div className="admin-empty t-ui-plain">{t('common.loading')}</div>;
  }

  if (editId && models !== undefined && !model) {
    return <div className="admin-empty t-ui-plain">{t('common.notFound')}</div>;
  }

  const toggleRole = (role: UserRole, checked: boolean) => {
    setAllowedRoles(prev => {
      const set = new Set(prev);
      if (checked) set.add(role);
      else set.delete(role);
      return Array.from(set) as UserRole[];
    });
  };

  const updateCaps = <K extends keyof ModelCapabilities>(key: K, value: ModelCapabilities[K]) => {
    setCapabilities(prev => ({ ...prev, [key]: value }));
    setPresetId('');
  };

  // Kept in the canonical ascending order so the assistant form's slider and the server's
  // clamping both see the same ladder without re-sorting.
  const toggleEffort = (level: ReasoningEffortLevel, checked: boolean) => {
    setPresetId('');
    setCapabilities(prev => {
      const next = new Set(prev.supportedEfforts);
      if (checked) next.add(level);
      else next.delete(level);
      return {
        ...prev,
        supportedEfforts: REASONING_EFFORT_ORDER.filter(l => next.has(l)),
      };
    });
  };

  // Overwrites protocol and capabilities. Model id, name and description are filled only when empty; the endpoint is never touched.
  const applyCatalogEntry = (entry: CatalogModelDto, currentModelId: string) => {
    setPresetId(entry.modelId);
    if (!currentModelId) setModelId(entry.modelId);
    setApiProtocol(entry.apiProtocol);
    setCapabilities(entry.capabilities);
    const cutoff = entry.capabilities.knowledgeCutoff;
    setKnowledgeCutoffMonth(typeof cutoff === 'string' && cutoff.length >= 7 ? cutoff.slice(0, 7) : '');
    if (!modelName) setModelName(entry.displayName);
    if (!description) setDescription(entry.description);
  };

  const findCatalogEntry = (id: string) =>
    catalog.find(c => c.modelId.toLowerCase() === id.toLowerCase());

  // A listed deployment applies the preset for the model it runs. Without a list, a typed name that equals a preset id applies that preset.
  // Nothing is applied while the deployments are loading.
  const handleModelIdChange = (value: string) => {
    setModelId(value);
    if (!deploymentsLoaded) return;
    const entry = endpointDeployments.length > 0
      ? (() => {
          const deployment = endpointDeployments.find(d => d.name.toLowerCase() === value.toLowerCase());
          return deployment ? findCatalogEntry(deployment.model) : undefined;
        })()
      : findCatalogEntry(value);
    if (entry) applyCatalogEntry(entry, value);
  };

  // The fields after the model field show once an endpoint and a model id are set
  const showDetails = !!endpointId && !!modelId;

  const canSave =
    !!modelId &&
    !!modelName &&
    !!description &&
    !!endpointId &&
    apiProtocol !== '' &&
    // AllowedRoles is enforced, so a model saved with no roles would be invisible to
    // everyone with nothing to explain why.
    allowedRoles.length > 0 &&
    Number(capabilities.maxContextTokens) > 0 &&
    Number(capabilities.maxOutputTokens) > 0 &&
    Number(capabilities.defaultMaxOutputTokens) > 0 &&
    Number(capabilities.defaultMaxOutputTokens) <= Number(capabilities.maxOutputTokens);

  const handleSave = async () => {
    // canSave already requires a protocol; TypeScript narrows apiProtocol through that alias.
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const capsToSend: ModelCapabilities = {
        ...capabilities,
        knowledgeCutoff: knowledgeCutoffMonth ? `${knowledgeCutoffMonth}-01T00:00:00Z` : null,
        tokenCountingScheme: capabilities.tokenCountingScheme?.trim() || null,
      };
      const payload = { modelId, modelName, description, endpointId, allowedRoles, allowedAsDefault, exposedInApi, apiProtocol, classification, capabilities: capsToSend };

      if (model) {
        await updateModel(model.id, { id: model.id, ...payload });
      } else {
        await createModel(payload);
      }
      await loadAdminData(true);
      navigate('/admin/models');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!model || testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testModel(model.id));
    } catch (error) {
      setTestResult({ success: false, error: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!model) return;
    if (!window.confirm(t('admin.models.dialog.delete.confirm'))) return;
    await deleteModel(model.id);
    await loadAdminData(true);
    navigate('/admin/models');
  };

  const dirty = hasChanges(
    { modelId, modelName, description, endpointId, allowedRoles, allowedAsDefault, exposedInApi, apiProtocol, classification, capabilities, knowledgeCutoffMonth },
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
        {model ? t('admin.models.dialog.edit.title') : t('admin.models.add.title')}
      </h1>
      <div className="page-title-bar" />

      <Stack gap="xl">
        <Select
          label={t('admin.models.fields.endpoint')}
          value={endpointId}
          onChange={setEndpointId}
        >
          {endpointId === '' && (
            <option value="" disabled>{t('admin.models.fields.endpointNone')}</option>
          )}
          {endpoints.map(ep => (
            <option key={ep.id} value={ep.id}>
              {ep.url} ({t(`admin.endpointType.${ep.endpointType}`)})
            </option>
          ))}
        </Select>

        {endpointId && (
          <Field label={t('admin.models.fields.modelId')}>
            <ModelCombobox
              value={modelId}
              options={modelOptions}
              placeholder={t('admin.models.fields.modelIdPlaceholder')}
              addedLabel={t('admin.models.fields.modelIdAdded')}
              otherLabel={t('admin.models.fields.modelIdOther')}
              onChange={handleModelIdChange}
            />
          </Field>
        )}

        {endpointId && catalog.length > 0 && (
          <Select
            label={t('admin.models.fields.knownModel')}
            description={t('admin.models.fields.knownModelHint')}
            value={presetId}
            onChange={(value) => {
              const entry = catalog.find(c => c.modelId === value);
              if (entry) applyCatalogEntry(entry, modelId);
              else setPresetId('');
            }}
          >
            <option value="">{t('admin.models.fields.knownModelCustom')}</option>
            {catalog.map(entry => (
              <option key={entry.modelId} value={entry.modelId}>
                {entry.displayName} ({t(`admin.endpointType.${entry.provider}`)})
              </option>
            ))}
          </Select>
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
                label={t('admin.models.fields.apiProtocol')}
                description={apiProtocol === '' ? t('admin.models.fields.apiProtocolRequired') : t('admin.models.fields.apiProtocolHint')}
                value={apiProtocol}
                onChange={(value) => {
                  setApiProtocol(value as ApiProtocol | '');
                  setPresetId('');
                }}
              >
                <option value="" disabled>{t('admin.models.fields.apiProtocolNone')}</option>
                {API_PROTOCOLS.map(protocol => (
                  <option key={protocol} value={protocol}>{t(`admin.apiProtocol.${protocol}`)}</option>
                ))}
              </Select>
            </Grid>

            <TextArea
              label={t('admin.models.fields.description')}
              value={description}
              onChange={setDescription}
              rows={3}
            />

            <Select
              label={t('admin.models.fields.classification')}
              value={classification}
              onChange={(value) => setClassification(value as DataClassification)}
            >
              {DATA_CLASSIFICATIONS.map(level => (
                <option key={level} value={level}>{t(`classification.${level}`)}</option>
              ))}
            </Select>

            <Field
              label={t('admin.models.fields.allowedRoles')}
              description={allowedRoles.length === 0 ? t('admin.models.fields.allowedRolesRequired') : undefined}
            >
              <CheckboxGroup>
                {ALL_ROLES.map(role => (
                  <Checkbox
                    key={role}
                    checked={allowedRoles.includes(role)}
                    onChange={(checked) => toggleRole(role, checked)}
                  >
                    {t(`roles.${role}`)}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </Field>

            <Checkbox checked={allowedAsDefault} onChange={setAllowedAsDefault} description={t('admin.models.fields.allowedAsDefaultHelp')}>
              {t('admin.models.fields.allowedAsDefault')}
            </Checkbox>

            <Checkbox checked={exposedInApi} onChange={setExposedInApi} description={t('admin.models.fields.exposedInApiHelp')}>
              {t('admin.models.fields.exposedInApi')}
            </Checkbox>

            <Stack gap="sm">
              <div className="t-overline">{t('admin.models.fields.capabilities')}</div>
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
              <CheckboxGroup>
                {REASONING_EFFORT_ORDER.map(level => (
                  <Checkbox
                    key={level}
                    checked={capabilities.supportedEfforts.includes(level)}
                    onChange={(checked) => toggleEffort(level, checked)}
                  >
                    {t(`assistants.form.reasoningLevels.${level.toLowerCase()}`)}
                  </Checkbox>
                ))}
              </CheckboxGroup>
            </Field>

            <Grid minColumnWidth="12rem" gap="lg">
              <TextInput
                label={t('admin.models.fields.maxContextTokens')}
                type="number"
                min={1}
                value={capabilities.maxContextTokens}
                onChange={(value) => updateCaps('maxContextTokens', parseInt(value || '0', 10))}
              />
              <TextInput
                label={t('admin.models.fields.maxOutputTokens')}
                type="number"
                min={1}
                value={capabilities.maxOutputTokens}
                onChange={(value) => updateCaps('maxOutputTokens', parseInt(value || '0', 10))}
              />
              <TextInput
                label={t('admin.models.fields.defaultMaxOutputTokens')}
                type="number"
                min={1}
                max={capabilities.maxOutputTokens || undefined}
                value={capabilities.defaultMaxOutputTokens}
                onChange={(value) => updateCaps('defaultMaxOutputTokens', parseInt(value || '0', 10))}
              />
              <TextInput
                label={t('admin.models.fields.knowledgeCutoff')}
                type="month"
                value={knowledgeCutoffMonth}
                onChange={(value) => {
                  setKnowledgeCutoffMonth(value);
                  setPresetId('');
                }}
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
          </>
        )}
      </Stack>

      {model && (
        <div className="admin-form-footer">
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={testing || dirty}
            title={dirty ? t('admin.models.test.saveFirst') : undefined}
          >
            {testing ? t('admin.models.test.running') : t('admin.models.test.button')}
          </Button>
          {testResult?.success && (
            <span className="admin-test-success" title={testResult.response ?? undefined}>
              <Icon name="check" size="xl" color="success" />
            </span>
          )}
          {testResult && !testResult.success && (
            <span className="admin-test-error t-caption">{testResult.error}</span>
          )}
          <Button variant="danger" ml="auto" onClick={handleDelete}>
            {t('admin.models.actions.delete')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ModelEditor;
