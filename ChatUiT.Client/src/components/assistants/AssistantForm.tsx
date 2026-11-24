import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { PROMPT_SNIPPET_IDS, withDescendants, type AssistantAccessPolicyDto, type AssistantFileRefDto, type CreateAssistantDto, type FullAssistantDto, type PromptSnippetId, type ChatToolDto, clampAssistantEffort, reasoningTier, type UpdateAssistantDto, type UserRole } from '../../types/assistantModels';
import { getModels } from '../../services/modelService';
import { getAppDefaults } from '../../services/appSettingsService';
import { getTools } from '../../services/toolService';
import { getKnowledgeSources } from '../../services/knowledgeSourceService';
import { adminToolsSignal } from '../../services/adminDataService';
import { searchAdminGroups, resolveAdminGroups } from '../../services/adminService';
import { ALL_ROLES, CLIENT_TOOLS_POLICY_ID, type AdminToolDto, type ToolAccessPolicyDto } from '../../types/admin';
import GroupPicker from '../common/GroupPicker';
import type { UserLanguageModelDto } from '../../types/modelModels';
import { createAssistant, updateAssistant, fetchAssistantFile, uploadAssistantFile, getAssistants } from '../../services/assistantService';
import { addNotification } from '../../services/notificationService';
import { ErrorCode } from '../../errors/errorCodes';
import { fileErrorText } from '../../services/fileService';
import TagField from '../common/TagField';
import ClassificationBadge from '../classification/ClassificationBadge';
import { SelectChevron } from '../common/Select';
import { Select, SelectContent, SelectItem, SelectLabel, SelectTrigger } from '@ui-sdk/react/select';
import TextInput from '../common/TextInput';
import TextArea from '../common/TextArea';
import Checkbox, { CheckboxGroup } from '../common/Checkbox';
import Field, { FieldDescription } from '../common/Field';
import Grid from '../common/Grid';
import Stack from '../common/Stack';
import { OptionContent } from '../common/Listbox';
import { floatingPanelClass } from '../common/floatingPanel';
import { spacePx } from '../common/layout';
import KnowledgeFileList, { type KnowledgeFileCategory, type KnowledgeFileItemData } from './KnowledgeFileList';
import KnowledgeSourceList from './KnowledgeSourceList';
import UnavailableOption from './UnavailableOption';
import CapabilityTag from './CapabilityTag';
import { capabilityKeys } from './assistantCapabilities';
import { alwaysLoadedLimit, formatTokens, parseScheme, type ParsedScheme } from '../../utils/tokenCounting';
import AlwaysLoadedBudget from './AlwaysLoadedBudget';
import EditorHeader from '../layout/EditorHeader';
import { hasChanges } from '../../utils/formChanges';
import Text from '../common/Text';
import Badge from '../common/Badge';
import Slider from '../common/Slider';

const createEmptyKnowledgeFiles = (): Record<KnowledgeFileCategory, KnowledgeFileItemData[]> => ({
  alwaysLoaded: [],
  selectiveLoaded: [],
  ragLoaded: []
});


/**
 * Whether everyone the assistant admits may also use the tool on their own. System assistants
 * ignore tool policies, so a false here is only a heads-up for the admin, never a block.
 */
const toolCoversAccess = (policy: ToolAccessPolicyDto, access: AssistantAccessPolicyDto | null) => {
  if (!policy.enabled) return false;
  if (access === null) return policy.allowedRoles.includes('User');
  return access.allowedRoles.every(role => policy.allowedRoles.includes(role))
    && access.allowedGroupIds.every(group => policy.allowedGroupIds.some(candidate => candidate.toLowerCase() === group.toLowerCase()));
};

const emptyFormData = (): CreateAssistantDto => ({
  name: '',
  description: '',
  tags: [],
  modelId: '',
  systemPrompt: '',
  reasoningEffort: 'None',
  availableToolIds: [],
  promptSnippets: [],
  knowledgeSourceIds: []
});

/** The form's values for the assistant being edited, or the defaults for a new one. */
const formStateFor = (editingAssistant: FullAssistantDto | null) => {
  if (!editingAssistant) {
    return { formData: emptyFormData(), knowledgeFiles: createEmptyKnowledgeFiles(), access: null as AssistantAccessPolicyDto | null };
  }

  const knowledgeFiles = createEmptyKnowledgeFiles();
  (editingAssistant.files ?? []).forEach((file) => {
    const category: KnowledgeFileCategory = file.category in knowledgeFiles ? file.category : 'alwaysLoaded';
    knowledgeFiles[category].push({
      id: crypto.randomUUID(),
      name: file.sourceFilename,
      description: file.description,
      fileId: file.id,
      tokenCounts: file.tokenCounts
    });
  });

  return {
    formData: {
      name: editingAssistant.name,
      description: editingAssistant.description || '',
      tags: editingAssistant.tags || [],
      modelId: editingAssistant.modelId,
      systemPrompt: editingAssistant.systemPrompt || '',
      reasoningEffort: editingAssistant.reasoningEffort,
      availableToolIds: editingAssistant.availableToolIds || [],
      promptSnippets: editingAssistant.promptSnippets ?? [],
      knowledgeSourceIds: editingAssistant.knowledgeSourceIds ?? []
    } satisfies CreateAssistantDto,
    knowledgeFiles,
    access: editingAssistant.access
      ? { allowedRoles: [...editingAssistant.access.allowedRoles], allowedGroupIds: [...editingAssistant.access.allowedGroupIds] }
      : null
  };
};

/** The endpoints the form saves through. */
export interface AssistantFormApi {
  /** Creates the assistant without files and returns its id. */
  create: (assistant: CreateAssistantDto) => Promise<{ id: string }>;
  update: (assistant: UpdateAssistantDto) => Promise<unknown>;
}

const userAssistantApi: AssistantFormApi = {
  create: createAssistant,
  update: updateAssistant
};

interface AssistantFormProps {
  editingAssistant: FullAssistantDto | null;
  /** The endpoints to save through. The user's own assistants when absent. */
  api?: AssistantFormApi;
  /** Called after a successful save */
  onSaved?: () => void;
  saveLabel?: string;
  /** Where the header's back and cancel buttons go */
  backPath: string;
  backLabel: string;
  /** Editing a system assistant as admin: every tool is offered, tool policies are not enforced, and access is editable. */
  systemAssistant?: boolean;
}

const AssistantForm: React.FC<AssistantFormProps> = ({
  editingAssistant,
  api = userAssistantApi,
  onSaved,
  saveLabel,
  backPath,
  backLabel,
  systemAssistant = false
}) => {
  useSignals();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const modelsSignal = getModels();
  const appDefaultsSignal = getAppDefaults();
  const toolsSignal = getTools();
  const knowledgeSourcesSignal = getKnowledgeSources();
  const [loading, setLoading] = useState(false);
  const [initialState, setInitialState] = useState(() => formStateFor(editingAssistant));
  const [access, setAccess] = useState<AssistantAccessPolicyDto | null>(initialState.access);

  const [knowledgeFiles, setKnowledgeFiles] = useState<Record<KnowledgeFileCategory, KnowledgeFileItemData[]>>(initialState.knowledgeFiles);
  // The id of a new assistant once it is created. The form then edits that assistant.
  const [createdId, setCreatedId] = useState<string | undefined>(undefined);
  const assistantId = editingAssistant?.id ?? createdId;

  const [formData, setFormData] = useState<CreateAssistantDto>(initialState.formData);

  // The form follows the assistant when it is fetched again, except while it is saving or holds
  // files that are not stored yet: those would be lost.
  const hasUnstoredFiles = Object.values(knowledgeFiles).flat().some((item) => item.file && !item.fileId);
  const [syncedAssistant, setSyncedAssistant] = useState(editingAssistant);
  if (editingAssistant !== syncedAssistant && !loading && !hasUnstoredFiles) {
    setSyncedAssistant(editingAssistant);
    const next = formStateFor(editingAssistant);
    setInitialState(next);
    setKnowledgeFiles(next.knowledgeFiles);
    setFormData(next.formData);
    setAccess(next.access);
  }

  const models: UserLanguageModelDto[] = modelsSignal.value ?? [];
  const selectedModel = models.find(m => m.id === formData.modelId);
  const supportedEfforts = selectedModel?.capabilities.assistantEfforts ?? [];
  const currentEffort = clampAssistantEffort(formData.reasoningEffort, supportedEfforts);

  // A stored file shows the server's token count for the selected model, and a file that is being uploaded shows how far it has come.
  const scheme = parseScheme(selectedModel?.capabilities.tokenCountingScheme);
  const trailingLabel = (item: KnowledgeFileItemData) => {
    if (item.upload) {
      return item.upload.status === 'uploading'
        ? t('files.upload.uploading', { percent: Math.round(item.upload.progress * 100) })
        : t(`files.upload.${item.upload.status}`);
    }
    const tokens = scheme ? item.tokenCounts?.[scheme.id] : undefined;
    return tokens === undefined
      ? undefined
      : `${scheme!.isEstimate ? '≈ ' : ''}${t('assistants.knowledge.budget.fileTokens', { tokens: formatTokens(tokens, i18n.language) })}`;
  };

  // Token budget for always-loaded files, from the server's counts of the stored files. A model
  // without a counter has no budget. Files that are not saved yet have no count: the server
  // counts them, and checks the budget, when they are uploaded.
  const storedAlwaysLoaded = knowledgeFiles.alwaysLoaded.filter((item) => item.fileId);
  const hasUnsavedAlwaysLoaded = storedAlwaysLoaded.length < knowledgeFiles.alwaysLoaded.length;
  const alwaysLoadedBudget = (model: UserLanguageModelDto, modelScheme: ParsedScheme) => ({
    used: storedAlwaysLoaded.every((item) => item.tokenCounts?.[modelScheme.id] !== undefined)
      ? storedAlwaysLoaded.reduce((sum, item) => sum + item.tokenCounts![modelScheme.id], 0)
      : undefined,
    limit: alwaysLoadedLimit(model.capabilities.contextSize)
  });
  const budget = selectedModel && scheme ? alwaysLoadedBudget(selectedModel, scheme) : undefined;
  // Over the limit blocks saving, except while the model is unchanged and the always-loaded
  // files cost no more than when saved.
  const savedAlwaysLoadedTokens = scheme && editingAssistant
    ? (editingAssistant.files ?? [])
        .filter((file) => file.category === 'alwaysLoaded')
        .reduce((sum, file) => sum + (file.tokenCounts?.[scheme.id] ?? 0), 0)
    : 0;
  const isOverBudget = budget?.used !== undefined && budget.used > budget.limit;
  const isBudgetBlocking = isOverBudget && (
    !editingAssistant ||
    formData.modelId !== editingAssistant.modelId ||
    budget.used! > savedAlwaysLoadedTokens
  );

  // The admin-configured default model, only once it is known to be selectable
  const defaultModelId = appDefaultsSignal.value?.defaultModelId ?? '';
  const selectableDefaultModelId = models.some(m => m.id === defaultModelId) ? defaultModelId : '';

  // Saving a model that is not default-eligible does not clear the pin, it just stops it
  // resolving — so warn before the save rather than after.
  const isPinnedAssistant =
    editingAssistant != null && getAssistants().value?.defaultAssistantId === editingAssistant.id;
  const pinWillGoInactive =
    isPinnedAssistant &&
    selectedModel != null &&
    !selectedModel.allowedAsDefault &&
    formData.modelId !== editingAssistant?.modelId;

  // System assistants ignore tool policies, so the admin picks from every tool; users pick from what they may use.
  // Leaves out the client tools policy row.
  const adminTools: AdminToolDto[] = systemAssistant
    ? (adminToolsSignal.value ?? []).filter(tool => tool.id !== CLIENT_TOOLS_POLICY_ID)
    : [];
  const toChatTool = (tool: AdminToolDto): ChatToolDto => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    requiresConfirmation: tool.requiresConfirmation,
    requiredScopes: tool.requiredScopes,
    execution: tool.execution,
    classification: tool.classification,
    children: adminTools.filter(child => child.parentId === tool.id).map(toChatTool),
  });
  const availableTools: ChatToolDto[] = systemAssistant
    ? adminTools.filter(tool => tool.parentId === null).map(toChatTool)
    : (toolsSignal.value || []);
  const availableToolIds = new Set(availableTools.flatMap(withDescendants).map(tool => tool.id));
  const toolPolicyById = new Map(adminTools.map(tool => [tool.id, tool.policy]));
  const toolIsWiderThanPolicy = (toolId: string) => {
    const policy = toolPolicyById.get(toolId);
    return systemAssistant && policy !== undefined && !toolCoversAccess(policy, access);
  };

  // Preselect the admin-configured default model when creating a new assistant.
  if (!editingAssistant && selectableDefaultModelId && !formData.modelId) {
    setFormData({ ...formData, modelId: selectableDefaultModelId });
  }

  const handleChange = (field: keyof CreateAssistantDto, value: CreateAssistantDto[keyof CreateAssistantDto]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleModelChange = (modelId: string) => {
    const newModel = models.find(m => m.id === modelId);
    const effort = clampAssistantEffort(formData.reasoningEffort, newModel?.capabilities.assistantEfforts);

    if (effort !== formData.reasoningEffort) {
      setFormData(prev => ({ ...prev, modelId, reasoningEffort: effort }));
    } else {
      handleChange('modelId', modelId);
    }
  };

  const selectedToolIds = formData.availableToolIds ?? [];
  const setToolSelection = (toolIds: string[]) => handleChange('availableToolIds', toolIds);

  // Unchecking a toolbox also unchecks its child toolboxes.
  const handleToolSelection = (tool: ChatToolDto, isSelected: boolean) => {
    const removed = new Set(withDescendants(tool).map(candidate => candidate.id));
    setToolSelection(isSelected ? [...selectedToolIds, tool.id] : selectedToolIds.filter(id => !removed.has(id)));
  };

  // A checked toolbox shows its child toolboxes under it.
  const renderToolbox = (tool: ChatToolDto): React.ReactNode => {
    const selected = selectedToolIds.includes(tool.id);
    const wider = selected && toolIsWiderThanPolicy(tool.id);
    return (
      <React.Fragment key={tool.id}>
        <Checkbox
          checked={selected}
          onChange={(checked) => handleToolSelection(tool, checked)}
          disabled={loading}
        >
          <span>
            <Text variant="table-strong" tone={wider ? 'warning' : 'inherit'}>{tool.name}</Text>
            {/* TODO: Gradering av verktøy er skjult for nå. Vi må komme tilbake til denne senere. */}
            {/* <ClassificationBadge classification={tool.classification} ml="sm" /> */}
            <Text tone="muted"> — {tool.description}</Text>
            {(tool.requiresConfirmation || wider) && (
              <Stack as="span" direction="row" gap="sm" wrap mt="xs">
                {tool.requiresConfirmation && (
                  <Badge>{t('assistants.form.toolHints.requiresConfirmation')}</Badge>
                )}
                {wider && (
                  <Badge tone="warning">{t('assistants.form.toolHints.widerAccess')}</Badge>
                )}
              </Stack>
            )}
          </span>
        </Checkbox>
        {selected && tool.children.length > 0 && (
          <Stack gap="sm" ml="2xl">{tool.children.map(renderToolbox)}</Stack>
        )}
      </React.Fragment>
    );
  };

  // Adds the picked files to the category. They are uploaded when the assistant is saved.
  const handleKnowledgeFilesSelected = (category: KnowledgeFileCategory, files: File[]) => {
    setKnowledgeFiles((prev) => ({
      ...prev,
      [category]: [...prev[category], ...files.map((file) => ({ id: crypto.randomUUID(), name: file.name, file }))]
    }));
  };

  const handleKnowledgeFileDescriptionChange = (
    category: KnowledgeFileCategory,
    itemId: string,
    description: string
  ) => {
    setKnowledgeFiles((prev) => ({
      ...prev,
      [category]: prev[category].map((item) => (
        item.id === itemId ? { ...item, description } : item
      ))
    }));
  };

  const handleKnowledgeFileRemove = (
    category: KnowledgeFileCategory,
    itemId: string
  ) => {
    setKnowledgeFiles((prev) => ({
      ...prev,
      [category]: prev[category].filter((item) => item.id !== itemId)
    }));
  };

  const updateKnowledgeFile = (itemId: string, change: Partial<KnowledgeFileItemData>) => {
    setKnowledgeFiles((prev) => Object.fromEntries(
      Object.entries(prev).map(([category, items]) => [category, items.map((item) => (item.id === itemId ? { ...item, ...change } : item))])
    ) as Record<KnowledgeFileCategory, KnowledgeFileItemData[]>);
  };

  /**
   * Uploads the files that are not stored yet to the assistant, one at a time in the order they
   * are listed. Returns every file as it is now: an uploaded file is stored, and a file that
   * failed stays as picked, with its error shown. `allStored` says whether none failed.
   */
  const uploadNewFiles = async (id: string) => {
    const changes = new Map<string, Partial<KnowledgeFileItemData>>();
    let allStored = true;
    for (const category of Object.keys(knowledgeFiles) as KnowledgeFileCategory[]) {
      for (const item of knowledgeFiles[category]) {
        if (!item.file || item.fileId) continue;

        updateKnowledgeFile(item.id, { upload: { status: 'uploading', progress: 0 } });
        try {
          const file = await uploadAssistantFile(id, item.file, category, item.description?.trim(), (progress) => {
            updateKnowledgeFile(item.id, { upload: progress < 1 ? { status: 'uploading', progress } : { status: 'converting', progress: 1 } });
          });
          const change = { name: file.sourceFilename, fileId: file.id, tokenCounts: file.tokenCounts, file: undefined, upload: undefined };
          changes.set(item.id, change);
          updateKnowledgeFile(item.id, change);
        } catch (error) {
          console.error(`Failed to upload file ${item.name}:`, error);
          allStored = false;
          updateKnowledgeFile(item.id, { upload: undefined });
          addNotification({ level: 'Error', message: `${item.name}: ${fileErrorText(error, ErrorCode.UploadFailed, t('files.uploadFailed'))}` });
        }
      }
    }

    const files = Object.fromEntries(
      Object.entries(knowledgeFiles).map(([category, items]) => [category, items.map((item) => ({ ...item, ...changes.get(item.id) }))])
    ) as Record<KnowledgeFileCategory, KnowledgeFileItemData[]>;
    return { files, allStored };
  };

  /** A stored file with its content, for the preview. */
  const loadStoredFile = async (item: KnowledgeFileItemData) => {
    if (!assistantId || !item.fileId) return null;
    try {
      return await fetchAssistantFile(assistantId, item.fileId);
    } catch (error) {
      console.error(`Failed to load file ${item.fileId}:`, error);
      return null;
    }
  };

  /** The stored files, as an update lists the files the assistant keeps. */
  const buildFileDtos = (files: Record<KnowledgeFileCategory, KnowledgeFileItemData[]>): AssistantFileRefDto[] => {
    return (Object.keys(files) as KnowledgeFileCategory[]).flatMap((category) =>
      files[category].filter((item) => item.fileId).map((item) => ({
        id: item.fileId!,
        sourceFilename: item.name,
        category,
        description: item.description?.trim()
      }))
    );
  };

  // The description is what the model reads to decide whether to load the file, so an
  // on-demand file without one cannot be saved. The server rejects it too.
  const hasMissingDescriptions = knowledgeFiles.selectiveLoaded.some((item) => !item.description?.trim());

  // The assistant is saved first: a new one is created without files, and an existing one is
  // updated, which deletes the stored files that were removed. The new files are then uploaded
  // to the assistant. The server checks the always-loaded budget in the update and at each upload.
  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.modelId || loading || hasMissingDescriptions || isBudgetBlocking) return;

    // Normalize unsupported params on submit
    const normalized: CreateAssistantDto = { ...formData };
    if (selectedModel) {
      normalized.reasoningEffort = clampAssistantEffort(
        formData.reasoningEffort,
        selectedModel.capabilities.assistantEfforts,
      );
      if (!selectedModel.capabilities.tools) {
        normalized.availableToolIds = [];
      }
    }
    if (systemAssistant) {
      normalized.access = access;
    }

    setLoading(true);
    try {
      let id = assistantId;
      if (id === undefined) {
        id = (await api.create(normalized)).id;
        setCreatedId(id);
      } else {
        await api.update({ id, ...normalized, files: buildFileDtos(knowledgeFiles) });
      }

      const { files, allStored } = await uploadNewFiles(id);
      // What is stored is the new baseline. A file that failed stays in the form as not saved.
      const storedFiles = Object.fromEntries(
        Object.entries(files).map(([category, items]) => [category, items.filter((item) => item.fileId)])
      ) as Record<KnowledgeFileCategory, KnowledgeFileItemData[]>;
      setInitialState({ formData, knowledgeFiles: storedFiles, access });
      if (allStored) onSaved?.();
    } catch (error) {
      console.error('Failed to save assistant:', error);
    } finally {
      setLoading(false);
    }
  };

  const dirty = useMemo(() => {
    // Files are compared by id and description
    const comparableState = (state: typeof initialState) => ({
      formData: state.formData,
      access: state.access,
      knowledgeFiles: Object.fromEntries(
        Object.entries(state.knowledgeFiles).map(([category, items]) => [category, items.map((item) => [item.id, item.description ?? ''])])
      ),
    });
    // The saved values, with a new assistant's preselected default model counted as saved
    const saved = { ...initialState, formData: { ...initialState.formData, modelId: initialState.formData.modelId || selectableDefaultModelId } };
    return hasChanges(comparableState({ formData, knowledgeFiles, access }), comparableState(saved));
  }, [formData, knowledgeFiles, access, initialState, selectableDefaultModelId]);

  return (
    <Stack gap="xl">
      <EditorHeader
        backPath={backPath}
        backLabel={backLabel}
        dirty={dirty}
        saveLabel={loading
          ? t('assistants.saving')
          : (saveLabel ?? (editingAssistant ? t('assistants.update') : t('common.create')))}
        saveDisabled={!formData.name.trim() || !formData.modelId || loading || hasMissingDescriptions || isBudgetBlocking}
        onSave={() => { void handleSubmit(); }}
        onCancel={() => navigate(backPath)}
      />
      <Grid gap="lg">
        <TextInput
          label={t('assistants.form.name')}
          value={formData.name}
          onChange={(value) => handleChange('name', value)}
          placeholder={t('assistants.form.namePlaceholder')}
          disabled={loading}
        />

        <div className="field">
          <Select value={formData.modelId || null} onValueChange={value => { if (value) handleModelChange(value); }} disabled={loading}>
            <SelectLabel className="field__label t-label">{t('assistants.form.model')}</SelectLabel>
            <SelectTrigger className="input-box input-box--medium input-box--full-width select-button t-body">
              <span className="select-button__value">
                {selectedModel ? (
                  <>
                    <Text truncate grow>{selectedModel.modelName}</Text>
                    <ClassificationBadge classification={selectedModel.classification} />
                  </>
                ) : <span className="select-button__placeholder">{t('assistants.form.selectModel')}</span>}
              </span>
              <SelectChevron />
            </SelectTrigger>
            <SelectContent sideOffset={spacePx('xs')} className={floatingPanelClass()} style={{ width: 'var(--anchor-width)' }}>
              {models.map(model => {
                const modelScheme = storedAlwaysLoaded.length > 0
                  ? parseScheme(model.capabilities.tokenCountingScheme)
                  : null;
                const modelBudget = modelScheme ? alwaysLoadedBudget(model, modelScheme) : undefined;
                return (
                  <SelectItem key={model.id} value={model.id} label={model.modelName}>
                    <OptionContent
                      description={(
                        <>
                          {model.description}
                          <Stack as="span" direction="row" wrap gap="xs" columnGap="md" mt="xs">
                            <Text variant="meta" wrap="nowrap">Context: {model.capabilities.contextSize.toLocaleString()}</Text>
                            <Text variant="meta" wrap="nowrap">Output: {model.capabilities.maxOutputTokens.toLocaleString()}</Text>
                            {model.capabilities.knowledgeCutoff && (
                              <Text variant="meta" wrap="nowrap">Knowledge: {model.capabilities.knowledgeCutoff}</Text>
                            )}
                          </Stack>
                          {modelBudget?.used !== undefined && modelBudget.used > modelBudget.limit && (
                            <Text variant="meta" tone="danger" block mt="xs">
                              {t('assistants.knowledge.budget.modelTooSmall', {
                                used: `${modelScheme!.isEstimate ? '≈ ' : ''}${formatTokens(modelBudget.used, i18n.language)}`,
                                limit: formatTokens(modelBudget.limit, i18n.language)
                              })}
                            </Text>
                          )}
                        </>
                      )}
                    >
                      <Text variant="ui" grow>{model.modelName}</Text>
                      <ClassificationBadge classification={model.classification} />
                      <Stack as="span" direction="row" gap="sm">
                        {capabilityKeys({ modelId: model.id }, models).map(key => (
                          <CapabilityTag key={key} capability={key} iconOnly />
                        ))}
                      </Stack>
                    </OptionContent>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {pinWillGoInactive && <FieldDescription>{t('assistants.form.modelNotDefaultEligible')}</FieldDescription>}
        </div>
      </Grid>

      <TextInput
        label={t('assistants.form.description')}
        value={formData.description}
        onChange={(value) => handleChange('description', value)}
        placeholder={t('assistants.form.description')}
        disabled={loading}
      />

      <Field label={t('assistants.form.tags')}>
        <TagField
          tags={formData.tags || []}
          onChange={(tags) => handleChange('tags', tags)}
          placeholder={t('assistants.form.tagsPlaceholder')}
          disabled={loading}
        />
      </Field>

      <Stack gap="sm">
        <TextArea
          label={t('assistants.form.systemPrompt')}
          labelAside={<Text variant="caption" tone="muted">{(formData.systemPrompt || '').length} {t('assistants.form.characters')}</Text>}
          value={formData.systemPrompt}
          onChange={(value) => handleChange('systemPrompt', value)}
          rows={6}
          placeholder={t('assistants.form.systemPromptPlaceholder')}
          disabled={loading}
        />
        <Field label={t('assistants.form.snippetsLabel')} mt="lg">
          <CheckboxGroup
            aria-label={t('assistants.form.snippetsLabel')}
            mt="xs"
            value={formData.promptSnippets ?? []}
            onChange={(value) => handleChange('promptSnippets', value as PromptSnippetId[])}
          >
            {PROMPT_SNIPPET_IDS.map((id) => (
              <Checkbox key={id} value={id} disabled={loading}>
                {t(`assistants.form.snippets.${id}`)}
              </Checkbox>
            ))}
          </CheckboxGroup>
        </Field>
      </Stack>

      <Field label={t('assistants.knowledge.title')}>
        <Stack gap="lg">
          {(['alwaysLoaded', 'selectiveLoaded', 'ragLoaded'] as const).map((category) => (
            <KnowledgeFileList
              key={category}
              title={t(`assistants.knowledge.categories.${category}.title`)}
              description={t(`assistants.knowledge.categories.${category}.description`)}
              emptyLabel={t('assistants.knowledge.noFilesAdded')}
              items={knowledgeFiles[category]}
              onFilesSelected={(files) => handleKnowledgeFilesSelected(category, files)}
              onLoadFile={loadStoredFile}
              disabled={loading}
              // Retrieval is not implemented on the server yet.
              unavailable={category === 'ragLoaded'}
              allowItemDescription={category === 'selectiveLoaded'}
              itemDescriptionPlaceholder={t('assistants.knowledge.shortDescriptionPlaceholder')}
              onItemDescriptionChange={(itemId, description) => handleKnowledgeFileDescriptionChange(category, itemId, description)}
              onItemRemove={(itemId) => handleKnowledgeFileRemove(category, itemId)}
              itemTrailingLabel={trailingLabel}
              status={category === 'alwaysLoaded' && budget && scheme && (
                <AlwaysLoadedBudget
                  used={budget.used}
                  hasUnsavedFiles={hasUnsavedAlwaysLoaded}
                  limit={budget.limit}
                  isEstimate={scheme.isEstimate}
                  blocked={isBudgetBlocking}
                />
              )}
            />
          ))}
          {hasMissingDescriptions && (
            <Text as="p" variant="meta" tone="danger" mt="sm" role="alert">
              {t('assistants.knowledge.descriptionRequired')}
            </Text>
          )}
          <KnowledgeSourceList
            sources={knowledgeSourcesSignal.value ?? []}
            value={formData.knowledgeSourceIds ?? []}
            onChange={(value) => handleChange('knowledgeSourceIds', value)}
            disabled={loading}
          />
        </Stack>
      </Field>

      {systemAssistant && (
        <Field label={t('assistants.form.access.title')}>
          <FieldDescription>{t('assistants.form.access.help')}</FieldDescription>
          <Checkbox
            checked={access === null}
            onChange={(checked) => setAccess(checked ? null : { allowedRoles: [], allowedGroupIds: [] })}
            disabled={loading}
          >
            {t('assistants.form.access.everyone')}
          </Checkbox>
          {access !== null && (
            <Stack gap="sm" mt="sm" pl="2xl">
              <Text as="div" variant="meta" tone="muted">{t('assistants.form.access.roles')}</Text>
              <CheckboxGroup mt="sm" value={access.allowedRoles} onChange={roles => setAccess({ ...access, allowedRoles: roles as UserRole[] })}>
                {ALL_ROLES.map(role => (
                  <Checkbox key={role} value={role} disabled={loading}>{t(`roles.${role}`)}</Checkbox>
                ))}
              </CheckboxGroup>
              <Text as="div" variant="meta" tone="muted">{t('assistants.form.access.groups')}</Text>
              <GroupPicker
                value={access.allowedGroupIds}
                search={searchAdminGroups}
                resolve={resolveAdminGroups}
                onChange={(ids) => setAccess(prev => ({ ...(prev ?? { allowedRoles: [], allowedGroupIds: [] }), allowedGroupIds: ids }))}
                disabled={loading}
              />
              {access.allowedRoles.length === 0 && access.allowedGroupIds.length === 0 && (
                <FieldDescription tone="warning">{t('assistants.form.access.nobodyWarning')}</FieldDescription>
              )}
            </Stack>
          )}
        </Field>
      )}

      <Grid gap="lg">
        <Field label={t('assistants.form.tools')}>
          {selectedModel?.capabilities.tools ? (
            availableTools.length > 0 ? (
              <CheckboxGroup mt="sm">
                {availableTools.map(renderToolbox)}
                {selectedToolIds.filter(id => !availableToolIds.has(id)).map(id => (
                  <UnavailableOption
                    key={id}
                    id={id}
                    note={t('assistants.form.toolUnavailable')}
                    checked
                    onChange={() => setToolSelection(selectedToolIds.filter(other => other !== id))}
                    disabled={loading}
                  />
                ))}
                {!systemAssistant && <FieldDescription>{t('assistants.form.toolsSharingNote')}</FieldDescription>}
              </CheckboxGroup>
            ) : (
              <FieldDescription>{t('assistants.form.noTools')}</FieldDescription>
            )
          ) : (
            <FieldDescription>{t('assistants.form.modelNoTools')}</FieldDescription>
          )}
        </Field>

        <Stack gap="lg">
          {supportedEfforts.length > 0 && (
            <Slider
              label={t('assistants.form.reasoningEffort')}
              labelAside={<Text variant="caption" tone="muted">{t(`assistants.form.reasoningTiers.${reasoningTier(currentEffort)}`)}</Text>}
              min={0}
              max={supportedEfforts.length - 1}
              step={1}
              value={Math.max(0, supportedEfforts.indexOf(currentEffort))}
              onChange={(value) => handleChange('reasoningEffort', supportedEfforts[value])}
              disabled={loading || supportedEfforts.length === 1}
              maxWidth="sm"
            />
          )}
        </Stack>
      </Grid>
    </Stack>
  );
};

export default AssistantForm;
