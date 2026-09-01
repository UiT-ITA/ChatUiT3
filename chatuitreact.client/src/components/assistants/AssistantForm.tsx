import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MdImage, MdPublic, MdPsychology, MdExpandMore, MdExpandLess } from 'react-icons/md';
import { useSignals } from '@preact/signals-react/runtime';
import type { AssistantFileDto, CreateAssistantDto, FullAssistantDto, ReasoningEffort, ChatToolDto, UpdateAssistantDto } from '../../types/assistantModels';
import { getModels } from '../../services/modelService';
import { getAppDefaults } from '../../services/appSettingsService';
import { getTools } from '../../services/toolService';
import type { UserModelDto } from '../../types/modelModels';
import { createAssistant, updateAssistant, fetchAssistantFile, getAssistants } from '../../services/assistantService';
import TagField from '../common/TagField';
import KnowledgeFileList, { type KnowledgeFileCategory, type KnowledgeFileItemData } from './KnowledgeFileList';
import type { ChatFile } from '../../types/fileModels';
import './AssistantForm.css';

const createEmptyKnowledgeFiles = (): Record<KnowledgeFileCategory, KnowledgeFileItemData[]> => ({
  alwaysLoaded: [],
  selectiveLoaded: [],
  ragLoaded: []
});

/**
 * Maps a chosen effort onto the nearest level the model accepts, mirroring the server's
 * clamping. A model that cannot reason resolves to 'None'; a model that always reasons
 * resolves 'None' up to its weakest level.
 */
const clampEffort = (
  requested: ReasoningEffort | undefined,
  supported: ReasoningEffort[] | undefined,
): ReasoningEffort => {
  const levels = supported ?? [];
  if (levels.length === 0) return 'None';

  const effort = requested ?? 'None';
  if (levels.includes(effort)) return effort;

  return levels[0];
};

/** True when a temperature control makes sense for the model at the current effort. */
const showsTemperature = (model: UserModelDto | undefined, effort: ReasoningEffort | undefined) => {
  if (!model) return false;
  if (model.capabilities.temperature === 'Supported') return true;
  // gpt-5.x rejects a non-default temperature while reasoning is active.
  return model.capabilities.temperature === 'SupportedWhenReasoningDisabled'
    && (effort ?? 'None') === 'None';
};

interface AssistantFormProps {
  editingAssistant: FullAssistantDto | null;
  onCreate?: (assistant: CreateAssistantDto) => Promise<unknown>;
  onUpdate?: (assistant: UpdateAssistantDto) => Promise<unknown>;
  /** Called after a successful save */
  onSaved?: () => void;
  /** Extra buttons rendered next to Save in the footer */
  footerExtra?: React.ReactNode;
  saveLabel?: string;
}

const AssistantForm: React.FC<AssistantFormProps> = ({
  editingAssistant,
  onCreate,
  onUpdate,
  onSaved,
  footerExtra,
  saveLabel
}) => {
  useSignals();
  const { t } = useTranslation();
  const modelsSignal = getModels();
  const appDefaultsSignal = getAppDefaults();
  const toolsSignal = getTools();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [knowledgeFiles, setKnowledgeFiles] = useState<Record<KnowledgeFileCategory, KnowledgeFileItemData[]>>(createEmptyKnowledgeFiles);
  const [systemPromptSnippets, setSystemPromptSnippets] = useState({
    renderMarkdown: false,
    includeBasicInfo: false,
    renderEquations: false
  });
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<CreateAssistantDto>({
    name: '',
    description: '',
    tags: [],
    modelId: '',
    systemPrompt: '',
    temperature: 0.7,
    reasoningEffort: 'None'
  });

  const models: UserModelDto[] = modelsSignal.value ?? [];
  const selectedModel = models.find(m => m.id === formData.modelId);
  const supportedEfforts = selectedModel?.capabilities.supportedEfforts ?? [];
  const currentEffort = clampEffort(formData.reasoningEffort, supportedEfforts);

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

  const availableTools: ChatToolDto[] = toolsSignal.value || [];
  const knowledgeSections: Array<{
    category: KnowledgeFileCategory;
    title: string;
    description: string;
    allowItemDescription?: boolean;
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
      description: t('assistants.knowledge.categories.ragLoaded.description')
    }
  ];

  // Initialize form data when editing
  useEffect(() => {
    if (editingAssistant) {
      const groupedFiles = createEmptyKnowledgeFiles();
      (editingAssistant.files ?? []).forEach((file) => {
        const category: KnowledgeFileCategory = file.category in groupedFiles ? file.category : 'alwaysLoaded';
        groupedFiles[category].push({
          id: crypto.randomUUID(),
          name: file.sourceFilename,
          description: file.description,
          fileId: file.id
        });
      });
      setKnowledgeFiles(groupedFiles);
      setFormData({
        name: editingAssistant.name,
        description: editingAssistant.description || '',
        tags: editingAssistant.tags || [],
        modelId: editingAssistant.modelId,
        systemPrompt: editingAssistant.systemPrompt || '',
        temperature: editingAssistant.temperature,
        reasoningEffort: editingAssistant.reasoningEffort,
        availableToolIds: editingAssistant.availableToolIds || []
      });
      setSelectedToolIds(editingAssistant.availableToolIds || []);
    } else {
      setKnowledgeFiles(createEmptyKnowledgeFiles());
      setFormData({
        name: '',
        description: '',
        tags: [],
        modelId: '',
        systemPrompt: '',
        temperature: 0.7,
        reasoningEffort: 'None',
        availableToolIds: []
      });
      setSelectedToolIds([]);
    }
  }, [editingAssistant]);

  // Preselect the admin-configured default model when creating a new assistant.
  // Runs separately because models and app defaults load asynchronously.
  useEffect(() => {
    if (editingAssistant || !selectableDefaultModelId) return;
    setFormData(prev => (prev.modelId ? prev : { ...prev, modelId: selectableDefaultModelId }));
  }, [editingAssistant, selectableDefaultModelId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };

    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelDropdownOpen]);

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
    setIsModelDropdownOpen(false);
  };

  const handleToolSelection = (toolId: string, isSelected: boolean) => {
    const newSelectedIds = isSelected
      ? [...selectedToolIds, toolId]
      : selectedToolIds.filter(id => id !== toolId);

    setSelectedToolIds(newSelectedIds);
    handleChange('availableToolIds', newSelectedIds);
  };

  const handleKnowledgeFilesSelected = (category: KnowledgeFileCategory, files: ChatFile[]) => {
    if (files.length === 0) {
      return;
    }

    const newItems = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.sourceFilename,
      ChatFile: file
    }));

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
        description: item.description,
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

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.modelId || loading) return;

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

    setLoading(true);
    try {
      if (editingAssistant) {
        await (onUpdate ?? updateAssistant)({
          id: editingAssistant.id,
          ...normalized
        });
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

  const renderCapabilityIcon = (capability: string, enabled: boolean, icon: React.ReactNode) => {
    if (!enabled) return null;

    return (
      <span key={capability} className="af-capability-icon" title={capability}>
        {icon}
      </span>
    );
  };

  return (
    <div className="assistant-form">
      <div className="af-grid">
        <div className="af-field">
          <label className="af-label t-label">{t('assistants.form.name')}</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="af-input t-body"
            placeholder={t('assistants.form.namePlaceholder')}
            disabled={loading}
          />
        </div>

        <div className="af-field">
          <label className="af-label t-label">{t('assistants.form.model')}</label>
          <div className="af-model-dropdown" ref={modelDropdownRef}>
            <button
              type="button"
              className="af-model-button t-body"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              disabled={loading}
            >
              <span className="af-model-button-text">
                {selectedModel ? selectedModel.modelName : t('assistants.form.selectModel')}
              </span>
              {isModelDropdownOpen ? <MdExpandLess size="1.25rem" /> : <MdExpandMore size="1.25rem" />}
            </button>

            {isModelDropdownOpen && (
              <div className="af-model-list">
                {models.map(model => (
                  <div
                    key={model.id}
                    className={`af-model-option ${formData.modelId === model.id ? 'selected' : ''}`}
                    onClick={() => handleModelChange(model.id)}
                  >
                    <div className="af-model-option-header">
                      <span className="af-model-name t-ui">{model.modelName}</span>
                      <div className="af-model-capabilities">
                        {renderCapabilityIcon('Vision', model.capabilities.vision, <MdImage size="1rem" />)}
                        {renderCapabilityIcon('Tools', model.capabilities.tools, <MdPublic size="1rem" />)}
                        {renderCapabilityIcon('Reasoning', model.capabilities.supportedEfforts.length > 0, <MdPsychology size="1rem" />)}
                      </div>
                    </div>
                    <div className="af-model-description t-caption">{model.description}</div>
                    <div className="af-model-specs t-meta">
                      <span>Context: {model.capabilities.contextSize.toLocaleString()}</span>
                      <span>Output: {model.capabilities.maxOutputTokens.toLocaleString()}</span>
                      {model.capabilities.knowledgeCutoff && (
                        <span>Knowledge: {model.capabilities.knowledgeCutoff}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {pinWillGoInactive && (
            <div className="af-note t-ui-plain">{t('assistants.form.modelNotDefaultEligible')}</div>
          )}
        </div>
      </div>

      <div className="af-field">
        <label className="af-label t-label">{t('assistants.form.description')}</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          className="af-input t-body"
          placeholder={t('assistants.form.description')}
          disabled={loading}
        />
      </div>

      <div className="af-field">
        <label className="af-label t-label">{t('assistants.form.tags')}</label>
        <TagField
          tags={formData.tags || []}
          onChange={(tags) => handleChange('tags', tags)}
          placeholder={t('assistants.form.tagsPlaceholder')}
          disabled={loading}
        />
      </div>

      <div className="af-field">
        <div className="af-label-row">
          <label className="af-label t-label">{t('assistants.form.systemPrompt')}</label>
          <span className="af-char-count t-meta">{(formData.systemPrompt || '').length} {t('assistants.form.characters')}</span>
        </div>
        <textarea
          value={formData.systemPrompt}
          onChange={(e) => handleChange('systemPrompt', e.target.value)}
          className="af-textarea t-body"
          rows={6}
          placeholder={t('assistants.form.systemPromptPlaceholder')}
          disabled={loading}
        />
        <div className="af-snippets">
          <label className="af-checkbox-label t-table">
            <input
              type="checkbox"
              checked={systemPromptSnippets.renderMarkdown}
              onChange={(e) => setSystemPromptSnippets(prev => ({ ...prev, renderMarkdown: e.target.checked }))}
              disabled={loading}
            />
            <span>{t('assistants.form.snippets.renderMarkdown')}</span>
          </label>
          <label className="af-checkbox-label t-table">
            <input
              type="checkbox"
              checked={systemPromptSnippets.includeBasicInfo}
              onChange={(e) => setSystemPromptSnippets(prev => ({ ...prev, includeBasicInfo: e.target.checked }))}
              disabled={loading}
            />
            <span>{t('assistants.form.snippets.includeBasicInfo')}</span>
          </label>
          <label className="af-checkbox-label t-table">
            <input
              type="checkbox"
              checked={systemPromptSnippets.renderEquations}
              onChange={(e) => setSystemPromptSnippets(prev => ({ ...prev, renderEquations: e.target.checked }))}
              disabled={loading}
            />
            <span>{t('assistants.form.snippets.renderEquations')}</span>
          </label>
        </div>
      </div>

      <div className="af-field">
        <label className="af-label t-label">{t('assistants.knowledge.title')}</label>
        <div className="af-knowledge">
          {knowledgeSections.map((section) => (
            <KnowledgeFileList
              key={section.category}
              category={section.category}
              title={section.title}
              description={section.description}
              emptyLabel={t('assistants.knowledge.noFilesAdded')}
              items={knowledgeFiles[section.category]}
              onFilesSelected={(files) => handleKnowledgeFilesSelected(section.category, files)}
              onLoadFile={loadKnowledgeFileContent}
              disabled={loading}
              allowItemDescription={section.allowItemDescription}
              itemDescriptionPlaceholder={t('assistants.knowledge.shortDescriptionPlaceholder')}
              onItemDescriptionChange={(itemId, description) => handleKnowledgeFileDescriptionChange(section.category, itemId, description)}
              onItemRemove={(itemId) => handleKnowledgeFileRemove(section.category, itemId)}
            />
          ))}
        </div>
      </div>

      <div className="af-grid">
        <div className="af-field">
          <label className="af-label t-label">{t('assistants.form.tools')}</label>
          {selectedModel?.capabilities.tools ? (
            availableTools.length > 0 ? (
              <div className="af-tools">
                {availableTools.map(tool => (
                  <label key={tool.id} className="af-checkbox-label af-tool t-table">
                    <input
                      type="checkbox"
                      checked={selectedToolIds.includes(tool.id)}
                      onChange={(e) => handleToolSelection(tool.id, e.target.checked)}
                      disabled={loading}
                    />
                    <span>
                      <span className="af-tool-name t-table-strong">{tool.name}</span>
                      <span className="af-tool-description"> — {tool.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="af-note t-ui-plain">{t('assistants.form.noTools')}</div>
            )
          ) : (
            <div className="af-note t-ui-plain">{t('assistants.form.modelNoTools')}</div>
          )}
        </div>

        <div className="af-field">
          {showsTemperature(selectedModel, formData.reasoningEffort) && (
            <div className="af-slider-field">
              <div className="af-label-row">
                <label className="af-label t-label">{t('assistants.form.temperature')}</label>
                <span className="af-char-count t-meta">{formData.temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                className="af-slider"
                disabled={loading}
              />
            </div>
          )}

          {/* Explains why the temperature control disappeared once reasoning was turned on. */}
          {selectedModel?.capabilities.temperature === 'SupportedWhenReasoningDisabled'
            && (formData.reasoningEffort ?? 'None') !== 'None' && (
            <div className="af-note t-ui-plain">{t('assistants.form.temperatureUnavailableWithReasoning')}</div>
          )}

          {supportedEfforts.length > 0 && (
            <div className="af-slider-field">
              <div className="af-label-row">
                <label className="af-label t-label">{t('assistants.form.reasoningEffort')}</label>
                <span className="af-char-count t-meta">{t(`assistants.form.reasoningLevels.${currentEffort.toLowerCase()}`)}</span>
              </div>
              <input
                type="range"
                min="0"
                max={supportedEfforts.length - 1}
                step="1"
                value={Math.max(0, supportedEfforts.indexOf(currentEffort))}
                onChange={(e) => handleChange('reasoningEffort', supportedEfforts[parseInt(e.target.value)])}
                className="af-slider"
                disabled={loading || supportedEfforts.length === 1}
              />
            </div>
          )}
        </div>
      </div>

      <div className="af-footer">
        <button
          type="button"
          className="af-save-button t-ui"
          onClick={handleSubmit}
          disabled={!formData.name.trim() || !formData.modelId || loading}
        >
          {loading
            ? t('assistants.saving')
            : (saveLabel ?? (editingAssistant ? t('assistants.update') : t('common.create')))}
        </button>
        {footerExtra}
      </div>
    </div>
  );
};

export default AssistantForm;
