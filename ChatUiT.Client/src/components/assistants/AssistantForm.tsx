import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import { PROMPT_SNIPPET_IDS, type AssistantAccessPolicyDto, type AssistantFileDto, type CreateAssistantDto, type FullAssistantDto, type PromptSnippetId, type ReasoningEffort, type ChatToolDto, type UpdateAssistantDto, type UserRole } from '../../types/assistantModels';
import { getModels } from '../../services/modelService';
import { getAppDefaults } from '../../services/appSettingsService';
import { getTools } from '../../services/toolService';
import { getKnowledgeSources } from '../../services/knowledgeSourceService';
import { adminToolsSignal } from '../../services/adminDataService';
import { clampEffort, type AdminToolDto, type ToolAccessPolicyDto } from '../../types/admin';
import GroupPicker from '../common/GroupPicker';
import type { UserLanguageModelDto } from '../../types/modelModels';
import { createAssistant, updateAssistant, fetchAssistantFile, getAssistants } from '../../services/assistantService';
import TagField from '../common/TagField';
import ClassificationBadge from '../common/ClassificationBadge';
import SelectButton from '../common/SelectButton';
import TextInput from '../common/TextInput';
import TextArea from '../common/TextArea';
import Checkbox, { CheckboxGroup } from '../common/Checkbox';
import Field, { FieldDescription } from '../common/Field';
import Grid from '../common/Grid';
import Stack from '../common/Stack';
import { Icon } from '../common/Icon';
import { Listbox, ListboxOption } from '../common/Listbox';
import Popover from '../common/Popover';
import KnowledgeFileList, { type KnowledgeFileCategory, type KnowledgeFileItemData } from './KnowledgeFileList';
import KnowledgeSourceList from './KnowledgeSourceList';
import type { ChatFile } from '../../types/fileModels';
import { getTokenizer, loadTokenizer } from '../../services/tokenizerService';
import { alwaysLoadedLimit, formatTokens, parseScheme, type ParsedScheme, type Tokenizer } from '../../utils/tokenCounting';
import AlwaysLoadedBudget, { type RejectedKnowledgeFile } from './AlwaysLoadedBudget';
import { knowledgeFileTokens, knowledgeFilesTokens } from './knowledgeTokens';
import EditorHeader from '../layout/EditorHeader';
import { hasChanges } from '../../utils/formChanges';
import './AssistantForm.css';
import Badge from '../common/Badge';
import Slider from '../common/Slider';

const createEmptyKnowledgeFiles = (): Record<KnowledgeFileCategory, KnowledgeFileItemData[]> => ({
  alwaysLoaded: [],
  selectiveLoaded: [],
  ragLoaded: []
});

/** True when a temperature control makes sense for the model at the current effort. */
const showsTemperature = (model: UserLanguageModelDto | undefined, effort: ReasoningEffort | undefined) => {
  if (!model) return false;
  if (model.capabilities.temperature === 'Supported') return true;
  // gpt-5.x rejects a non-default temperature while reasoning is active.
  return model.capabilities.temperature === 'SupportedWhenReasoningDisabled'
    && (effort ?? 'None') === 'None';
};

const ALL_ROLES: UserRole[] = ['User', 'Admin', 'Beta', 'Super', 'External'];

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
  temperature: 0.7,
  reasoningEffort: 'None',
  availableToolIds: [],
  promptSnippets: [],
  knowledgeSourceIds: []
});

/** The form's values for the assistant being edited, or the defaults for a new one. */
const formStateFor = (editingAssistant: FullAssistantDto | null) => {
  if (!editingAssistant) {
    return { formData: emptyFormData(), knowledgeFiles: createEmptyKnowledgeFiles(), selectedToolIds: [] as string[], access: null as AssistantAccessPolicyDto | null };
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
      temperature: editingAssistant.temperature,
      reasoningEffort: editingAssistant.reasoningEffort,
      availableToolIds: editingAssistant.availableToolIds || [],
      promptSnippets: editingAssistant.promptSnippets ?? [],
      knowledgeSourceIds: editingAssistant.knowledgeSourceIds ?? []
    } satisfies CreateAssistantDto,
    knowledgeFiles,
    selectedToolIds: editingAssistant.availableToolIds || [],
    access: editingAssistant.access
      ? { allowedRoles: [...editingAssistant.access.allowedRoles], allowedGroupIds: [...editingAssistant.access.allowedGroupIds] }
      : null
  };
};

interface AssistantFormProps {
  editingAssistant: FullAssistantDto | null;
  onCreate?: (assistant: CreateAssistantDto) => Promise<unknown>;
  onUpdate?: (assistant: UpdateAssistantDto) => Promise<unknown>;
  /** Called after a successful save */
  onSaved?: () => void;
  /** Extra buttons rendered in the footer */
  footerExtra?: React.ReactNode;
  saveLabel?: string;
  /** Where the header's back and cancel buttons go */
  backPath: string;
  backLabel: string;
  /** Editing a system assistant as admin: every tool is offered, tool policies are not enforced, and access is editable. */
  systemAssistant?: boolean;
}

const AssistantForm: React.FC<AssistantFormProps> = ({
  editingAssistant,
  onCreate,
  onUpdate,
  onSaved,
  footerExtra,
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
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialState, setInitialState] = useState(() => formStateFor(editingAssistant));
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>(initialState.selectedToolIds);
  const [access, setAccess] = useState<AssistantAccessPolicyDto | null>(initialState.access);

  const [knowledgeFiles, setKnowledgeFiles] = useState<Record<KnowledgeFileCategory, KnowledgeFileItemData[]>>(initialState.knowledgeFiles);
  const [rejectedFiles, setRejectedFiles] = useState<RejectedKnowledgeFile[]>([]);

  const [formData, setFormData] = useState<CreateAssistantDto>(initialState.formData);

  const [syncedAssistant, setSyncedAssistant] = useState(editingAssistant);
  if (editingAssistant !== syncedAssistant) {
    setSyncedAssistant(editingAssistant);
    const next = formStateFor(editingAssistant);
    setInitialState(next);
    setKnowledgeFiles(next.knowledgeFiles);
    setFormData(next.formData);
    setSelectedToolIds(next.selectedToolIds);
    setAccess(next.access);
    setRejectedFiles([]);
  }

  const models: UserLanguageModelDto[] = modelsSignal.value ?? [];
  const selectedModel = models.find(m => m.id === formData.modelId);
  const supportedEfforts = selectedModel?.capabilities.supportedEfforts ?? [];
  const currentEffort = clampEffort(formData.reasoningEffort, supportedEfforts);

  // Token budget for always-loaded files. A model without a counter has no budget.
  const scheme = parseScheme(selectedModel?.capabilities.tokenCountingScheme);
  const tokenizer = scheme ? getTokenizer(scheme).value : undefined;
  const alwaysLoadedBudget = (model: UserLanguageModelDto, modelScheme: ParsedScheme, modelTokenizer: Tokenizer | undefined) => ({
    used: knowledgeFilesTokens(knowledgeFiles.alwaysLoaded, modelScheme, modelTokenizer),
    limit: alwaysLoadedLimit(model.capabilities.contextSize)
  });
  const budget = selectedModel && scheme ? alwaysLoadedBudget(selectedModel, scheme, tokenizer) : undefined;
  const isBudgetUnavailable = scheme !== null &&
    knowledgeFiles.alwaysLoaded.some((item) => !item.ChatFile && item.tokenCounts?.[scheme.id] === undefined);
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
  // The files and model as of the latest render, for the upload handler.
  const latestRef = useRef({ knowledgeFiles, model: selectedModel });
  useEffect(() => {
    latestRef.current = { knowledgeFiles, model: selectedModel };
  }, [knowledgeFiles, selectedModel]);

  const tokenLabel = (item: KnowledgeFileItemData) => {
    if (!scheme) return undefined;
    const tokens = knowledgeFileTokens(item, scheme, tokenizer);
    return tokens === undefined
      ? undefined
      : `${scheme.isEstimate ? '≈ ' : ''}${t('assistants.knowledge.budget.fileTokens', { tokens: formatTokens(tokens, i18n.language) })}`;
  };

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
  const adminTools: AdminToolDto[] = systemAssistant ? (adminToolsSignal.value ?? []) : [];
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
  const withDescendants = (tool: ChatToolDto): ChatToolDto[] => [tool, ...tool.children.flatMap(withDescendants)];
  const availableToolIds = new Set(availableTools.flatMap(withDescendants).map(tool => tool.id));
  const toolPolicyById = new Map(adminTools.map(tool => [tool.id, tool.policy]));
  const toolIsWiderThanPolicy = (toolId: string) => {
    const policy = toolPolicyById.get(toolId);
    return systemAssistant && policy !== undefined && !toolCoversAccess(policy, access);
  };

  const toggleAccessRole = (role: UserRole, checked: boolean) => {
    setAccess(prev => {
      const current = prev ?? { allowedRoles: [], allowedGroupIds: [] };
      const set = new Set(current.allowedRoles);
      if (checked) set.add(role);
      else set.delete(role);
      return { ...current, allowedRoles: ALL_ROLES.filter(candidate => set.has(candidate)) };
    });
  };

  const knowledgeSections: Array<{
    category: KnowledgeFileCategory;
    title: string;
    description: string;
    allowItemDescription?: boolean;
    unavailable?: boolean;
  }> = [
    {
      category: 'alwaysLoaded',
      title: t('assistants.knowledge.categories.alwaysLoaded.title'),
      description: t('assistants.knowledge.categories.alwaysLoaded.description')
    },
    {
      category: 'selectiveLoaded',
      title: t('assistants.knowledge.categories.selectiveLoaded.title'),
      description: t('assistants.knowledge.categories.selectiveLoaded.description'),
      allowItemDescription: true
    },
    {
      category: 'ragLoaded',
      title: t('assistants.knowledge.categories.ragLoaded.title'),
      description: t('assistants.knowledge.categories.ragLoaded.description'),
      // Retrieval is not implemented on the server yet.
      unavailable: true
    }
  ];

  // Preselect the admin-configured default model when creating a new assistant.
  if (!editingAssistant && selectableDefaultModelId && !formData.modelId) {
    setFormData({ ...formData, modelId: selectableDefaultModelId });
  }


  const handleChange = (field: keyof CreateAssistantDto, value: CreateAssistantDto[keyof CreateAssistantDto]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleModelChange = (modelId: string) => {
    const newModel = models.find(m => m.id === modelId);
    const effort = clampEffort(formData.reasoningEffort, newModel?.capabilities.supportedEfforts);

    if (effort !== formData.reasoningEffort) {
      setFormData(prev => ({ ...prev, modelId, reasoningEffort: effort }));
    } else {
      handleChange('modelId', modelId);
    }
    setRejectedFiles([]);
    setIsModelDropdownOpen(false);
  };

  const setToolSelection = (toolIds: string[]) => {
    setSelectedToolIds(toolIds);
    handleChange('availableToolIds', toolIds);
  };

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
          <span className={wider ? 'af-tool-wider' : undefined}>
            <span className="af-tool-name t-table-strong">{tool.name}</span>
            <ClassificationBadge classification={tool.classification} ml="sm" />
            <span className="af-tool-description"> — {tool.description}</span>
            {(tool.requiresConfirmation || wider) && (
              <Stack as="span" direction="row" gap="sm" wrap mt="2xs">
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
          <div className="af-tool-children">{tool.children.map(renderToolbox)}</div>
        )}
      </React.Fragment>
    );
  };

  const selectedSnippets: PromptSnippetId[] = formData.promptSnippets ?? [];
  const toggleSnippet = (id: PromptSnippetId, enabled: boolean) => {
    const next = enabled
      ? [...selectedSnippets.filter((s) => s !== id), id]
      : selectedSnippets.filter((s) => s !== id);
    handleChange('promptSnippets', next);
  };

  const selectedKnowledgeSourceIds = formData.knowledgeSourceIds ?? [];
  const toggleKnowledgeSource = (id: string, enabled: boolean) => {
    const next = enabled
      ? [...selectedKnowledgeSourceIds.filter((s) => s !== id), id]
      : selectedKnowledgeSourceIds.filter((s) => s !== id);
    handleChange('knowledgeSourceIds', next);
  };

  // Adds always-loaded files in order while they fit the budget and refuses the rest with a
  // notice. Adds all files when there is no counter or the files cannot be counted.
  const handleKnowledgeFilesSelected = async (category: KnowledgeFileCategory, files: ChatFile[]) => {
    if (files.length === 0) {
      return;
    }

    let newItems: KnowledgeFileItemData[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.sourceFilename,
      ChatFile: file
    }));

    const model = latestRef.current.model;
    const modelScheme = parseScheme(model?.capabilities.tokenCountingScheme);
    if (category === 'alwaysLoaded' && model && modelScheme) {
      const loadedTokenizer = await loadTokenizer(modelScheme);
      const used = loadedTokenizer
        ? knowledgeFilesTokens(latestRef.current.knowledgeFiles.alwaysLoaded, modelScheme, loadedTokenizer)
        : undefined;

      if (loadedTokenizer && used !== undefined) {
        const limit = alwaysLoadedLimit(model.capabilities.contextSize);
        const accepted: KnowledgeFileItemData[] = [];
        const rejected: RejectedKnowledgeFile[] = [];
        let total = used;
        for (const item of newItems) {
          const tokens = knowledgeFileTokens(item, modelScheme, loadedTokenizer) ?? 0;
          if (total + tokens > limit) {
            rejected.push({ id: item.id, name: item.name, tokens, remaining: limit - total });
          } else {
            accepted.push(item);
            total += tokens;
          }
        }
        newItems = accepted;
        setRejectedFiles(rejected);
      }
    }

    if (newItems.length === 0) {
      return;
    }

    setKnowledgeFiles((prev) => ({
      ...prev,
      [category]: [...prev[category], ...newItems]
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

  const buildFileDtos = (): AssistantFileDto[] => {
    return (Object.keys(knowledgeFiles) as KnowledgeFileCategory[]).flatMap((category) =>
      knowledgeFiles[category].map((item) => ({
        id: item.fileId,
        sourceFilename: item.name,
        category,
        description: item.description?.trim(),
        // Already-stored files are sent without content; the server keeps them as-is.
        chunks: item.ChatFile
          ? item.ChatFile.chunks.map((chunk) => ({
              type: chunk.type,
              text: chunk.type === 'text' ? chunk.text : undefined,
              format: chunk.type === 'text' ? chunk.format : undefined,
              base64: chunk.type === 'image' ? chunk.base64 : undefined
            }))
          : []
      }))
    );
  };

  const loadKnowledgeFileContent = async (item: KnowledgeFileItemData): Promise<ChatFile | null> => {
    if (!editingAssistant || !item.fileId) {
      return null;
    }

    try {
      const file = await fetchAssistantFile(editingAssistant.id, item.fileId);
      return {
        id: file.id ?? item.fileId,
        sourceFilename: file.sourceFilename,
        chunks: file.chunks.map((chunk) => (
          chunk.type === 'image'
            ? { type: 'image' as const, base64: chunk.base64 ?? '' }
            : { type: 'text' as const, text: chunk.text ?? '', format: chunk.format ?? 'plain' }
        ))
      };
    } catch (error) {
      console.error(`Failed to load assistant file ${item.fileId}:`, error);
      return null;
    }
  };

  // The description is what the model reads to decide whether to load the file, so an
  // on-demand file without one cannot be saved. The server rejects it too.
  const hasMissingDescriptions = knowledgeFiles.selectiveLoaded.some((item) => !item.description?.trim());

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.modelId || loading || hasMissingDescriptions || isBudgetBlocking) return;

    // Normalize unsupported params on submit
    const normalized: CreateAssistantDto = { ...formData, files: buildFileDtos() };
    if (selectedModel) {
      normalized.reasoningEffort = clampEffort(
        formData.reasoningEffort,
        selectedModel.capabilities.supportedEfforts,
      );
      if (!showsTemperature(selectedModel, normalized.reasoningEffort)) {
        normalized.temperature = 1;
      }
      if (!selectedModel.capabilities.tools) {
        normalized.availableToolIds = [];
      }
    }
    if (systemAssistant) {
      normalized.access = access;
    }

    setLoading(true);
    try {
      if (editingAssistant) {
        await (onUpdate ?? updateAssistant)({
          id: editingAssistant.id,
          ...normalized
        });
        // The saved values are the new baseline until the assistant list is refetched
        setInitialState({ formData, knowledgeFiles, selectedToolIds, access });
      } else {
        await (onCreate ?? createAssistant)(normalized);
      }
      onSaved?.();
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
      selectedToolIds: state.selectedToolIds,
      access: state.access,
      knowledgeFiles: Object.fromEntries(
        Object.entries(state.knowledgeFiles).map(([category, items]) => [category, items.map((item) => [item.id, item.description ?? ''])])
      ),
    });
    // The saved values, with a new assistant's preselected default model counted as saved
    const saved = { ...initialState, formData: { ...initialState.formData, modelId: initialState.formData.modelId || selectableDefaultModelId } };
    return hasChanges(comparableState({ formData, knowledgeFiles, selectedToolIds, access }), comparableState(saved));
  }, [formData, knowledgeFiles, selectedToolIds, access, initialState, selectableDefaultModelId]);

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
      <Grid minColumnWidth="12rem" gap="lg">
        <TextInput
          label={t('assistants.form.name')}
          value={formData.name}
          onChange={(value) => handleChange('name', value)}
          placeholder={t('assistants.form.namePlaceholder')}
          disabled={loading}
        />

        <Popover
          open={isModelDropdownOpen}
          onOpenChange={setIsModelDropdownOpen}
          placement="bottom-start"
          offset="xs"
          panelWidth="trigger"
          width="full"
          minWidth="0"
          disabled={loading}
          trigger={(
            <SelectButton
              label={t('assistants.form.model')}
              description={pinWillGoInactive ? t('assistants.form.modelNotDefaultEligible') : undefined}
              placeholder={t('assistants.form.selectModel')}
              disabled={loading}
            >
              {selectedModel && (
                <>
                  <span className="af-model-button-text">{selectedModel.modelName}</span>
                  <ClassificationBadge classification={selectedModel.classification} />
                </>
              )}
            </SelectButton>
          )}
        >
          <Listbox maxHeight="20rem">
            {models.map(model => {
              const modelScheme = knowledgeFiles.alwaysLoaded.length > 0
                ? parseScheme(model.capabilities.tokenCountingScheme)
                : null;
              const modelBudget = modelScheme
                ? alwaysLoadedBudget(model, modelScheme, getTokenizer(modelScheme).value)
                : undefined;
              return (
                <ListboxOption
                  key={model.id}
                  selected={formData.modelId === model.id}
                  onClick={() => handleModelChange(model.id)}
                  description={(
                    <>
                      {model.description}
                      <span className="af-model-specs t-meta">
                        <span>Context: {model.capabilities.contextSize.toLocaleString()}</span>
                        <span>Output: {model.capabilities.maxOutputTokens.toLocaleString()}</span>
                        {model.capabilities.knowledgeCutoff && (
                          <span>Knowledge: {model.capabilities.knowledgeCutoff}</span>
                        )}
                      </span>
                      {modelBudget?.used !== undefined && modelBudget.used > modelBudget.limit && (
                        <span className="af-model-budget t-meta">
                          {t('assistants.knowledge.budget.modelTooSmall', {
                            used: `${modelScheme!.isEstimate ? '≈ ' : ''}${formatTokens(modelBudget.used, i18n.language)}`,
                            limit: formatTokens(modelBudget.limit, i18n.language)
                          })}
                        </span>
                      )}
                    </>
                  )}
                >
                  <span className="af-model-name t-ui">{model.modelName}</span>
                  <ClassificationBadge classification={model.classification} />
                  <span className="af-model-capabilities">
                    {model.capabilities.vision && <Icon name="image" color="accent" label="Vision" />}
                    {model.capabilities.tools && <Icon name="globe" color="accent" label="Tools" />}
                    {model.capabilities.supportedEfforts.length > 0 && <Icon name="brain" color="accent" label="Reasoning" />}
                  </span>
                </ListboxOption>
              );
            })}
          </Listbox>
        </Popover>
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
          labelAside={<span className="af-char-count t-meta">{(formData.systemPrompt || '').length} {t('assistants.form.characters')}</span>}
          value={formData.systemPrompt}
          onChange={(value) => handleChange('systemPrompt', value)}
          rows={6}
          placeholder={t('assistants.form.systemPromptPlaceholder')}
          disabled={loading}
        />
        <CheckboxGroup>
          {PROMPT_SNIPPET_IDS.map((id) => (
            <Checkbox
              key={id}
              checked={selectedSnippets.includes(id)}
              onChange={(checked) => toggleSnippet(id, checked)}
              disabled={loading}
            >
              {t(`assistants.form.snippets.${id}`)}
            </Checkbox>
          ))}
        </CheckboxGroup>
      </Stack>

      <Field label={t('assistants.knowledge.title')}>
        <Stack gap="lg">
          {knowledgeSections.map((section) => (
            <KnowledgeFileList
              key={section.category}
              title={section.title}
              description={section.description}
              emptyLabel={t('assistants.knowledge.noFilesAdded')}
              items={knowledgeFiles[section.category]}
              onFilesSelected={(files) => void handleKnowledgeFilesSelected(section.category, files)}
              onLoadFile={loadKnowledgeFileContent}
              disabled={loading}
              unavailable={section.unavailable}
              allowItemDescription={section.allowItemDescription}
              itemDescriptionPlaceholder={t('assistants.knowledge.shortDescriptionPlaceholder')}
              onItemDescriptionChange={(itemId, description) => handleKnowledgeFileDescriptionChange(section.category, itemId, description)}
              onItemRemove={(itemId) => handleKnowledgeFileRemove(section.category, itemId)}
              itemTokenLabel={tokenLabel}
              status={section.category === 'alwaysLoaded' && budget && scheme && (
                <AlwaysLoadedBudget
                  used={budget.used}
                  unavailable={isBudgetUnavailable}
                  limit={budget.limit}
                  isEstimate={scheme.isEstimate}
                  blocked={isBudgetBlocking}
                  rejected={rejectedFiles}
                  onDismissRejected={() => setRejectedFiles([])}
                />
              )}
            />
          ))}
          {hasMissingDescriptions && (
            <p className="af-knowledge-hint t-meta" role="alert">
              {t('assistants.knowledge.descriptionRequired')}
            </p>
          )}
          <KnowledgeSourceList
            sources={knowledgeSourcesSignal.value ?? []}
            selectedIds={selectedKnowledgeSourceIds}
            onToggle={toggleKnowledgeSource}
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
            <div className="af-access">
              <div className="af-access-label t-meta">{t('assistants.form.access.roles')}</div>
              <CheckboxGroup mt="sm">
                {ALL_ROLES.map(role => (
                  <Checkbox
                    key={role}
                    checked={access.allowedRoles.includes(role)}
                    onChange={(checked) => toggleAccessRole(role, checked)}
                    disabled={loading}
                  >
                    {t(`roles.${role}`)}
                  </Checkbox>
                ))}
              </CheckboxGroup>
              <div className="af-access-label t-meta">{t('assistants.form.access.groups')}</div>
              <GroupPicker
                value={access.allowedGroupIds}
                onChange={(ids) => setAccess(prev => ({ ...(prev ?? { allowedRoles: [], allowedGroupIds: [] }), allowedGroupIds: ids }))}
                disabled={loading}
              />
              {access.allowedRoles.length === 0 && access.allowedGroupIds.length === 0 && (
                <FieldDescription tone="warning">{t('assistants.form.access.nobodyWarning')}</FieldDescription>
              )}
            </div>
          )}
        </Field>
      )}

      <Grid minColumnWidth="12rem" gap="lg">
        <Field label={t('assistants.form.tools')}>
          {selectedModel?.capabilities.tools ? (
            availableTools.length > 0 ? (
              <CheckboxGroup mt="sm">
                {availableTools.map(renderToolbox)}
                {selectedToolIds.filter(id => !availableToolIds.has(id)).map(id => (
                  <Checkbox
                    key={id}
                    checked
                    onChange={() => setToolSelection(selectedToolIds.filter(other => other !== id))}
                    disabled={loading}
                  >
                    <span className="af-tool-unavailable">
                      <span className="af-tool-name t-table-strong">{id}</span>
                      <span className="af-tool-description"> — {t('assistants.form.toolUnavailable')}</span>
                    </span>
                  </Checkbox>
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
          {showsTemperature(selectedModel, formData.reasoningEffort) && (
            <Slider
              label={t('assistants.form.temperature')}
              labelAside={<span className="af-char-count t-meta">{formData.temperature}</span>}
              min={0}
              max={1}
              step={0.1}
              value={formData.temperature}
              onChange={(value) => handleChange('temperature', value)}
              disabled={loading}
              maxWidth="20rem"
            />
          )}

          {/* Explains why the temperature control disappeared once reasoning was turned on. */}
          {selectedModel?.capabilities.temperature === 'SupportedWhenReasoningDisabled'
            && (formData.reasoningEffort ?? 'None') !== 'None' && (
            <FieldDescription>{t('assistants.form.temperatureUnavailableWithReasoning')}</FieldDescription>
          )}

          {supportedEfforts.length > 0 && (
            <Slider
              label={t('assistants.form.reasoningEffort')}
              labelAside={<span className="af-char-count t-meta">{t(`assistants.form.reasoningLevels.${currentEffort.toLowerCase()}`)}</span>}
              min={0}
              max={supportedEfforts.length - 1}
              step={1}
              value={Math.max(0, supportedEfforts.indexOf(currentEffort))}
              onChange={(value) => handleChange('reasoningEffort', supportedEfforts[value])}
              disabled={loading || supportedEfforts.length === 1}
              maxWidth="20rem"
            />
          )}
        </Stack>
      </Grid>

      {footerExtra && (
        <div className="af-footer">
          {footerExtra}
        </div>
      )}
    </Stack>
  );
};

export default AssistantForm;
