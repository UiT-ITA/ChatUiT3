import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MdImage, MdPublic, MdPsychology, MdExpandMore, MdExpandLess } from 'react-icons/md';
import { useSignals } from '@preact/signals-react/runtime';
import type { AssistantFileDto, CreateAssistantDto, FullAssistantDto, ReasoningEffort, ChatToolDto, UpdateAssistantDto } from '../../types/assistantModels';
import { getModels } from '../../services/modelService';
import { getTools } from '../../services/toolService';
import type { UserModelDto } from '../../types/modelModels';
import { createAssistant, updateAssistant, fetchAssistantFile } from '../../services/assistantService';
import TagField from '../common/TagField';
import KnowledgeFileList, { type KnowledgeFileCategory, type KnowledgeFileItemData } from './KnowledgeFileList';
import type { ChatFile } from '../../types/fileModels';
import './AssistantForm.css';

const createEmptyKnowledgeFiles = (): Record<KnowledgeFileCategory, KnowledgeFileItemData[]> => ({
  alwaysLoaded: [],
  selectiveLoaded: [],
  ragLoaded: []
});

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

    // If switching to a non-reasoning model, reset reasoning effort to None
    if (newModel && !newModel.capabilities.reasoning && formData.reasoningEffort !== 'None') {
      setFormData(prev => ({
        ...prev,
        modelId,
        reasoningEffort: 'None'
      }));
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
      if (!selectedModel.capabilities.supportsTemperature) {
        normalized.temperature = 1;
      }
      if (!selectedModel.capabilities.tools) {
        normalized.availableToolIds = [];
      }
      if (!selectedModel.capabilities.reasoning) {
        normalized.reasoningEffort = 'None';
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
                        {renderCapabilityIcon('Reasoning', model.capabilities.reasoning, <MdPsychology size="1rem" />)}
                      </div>
                    </div>
                    <div className="af-model-description t-caption">{model.description}</div>
                    <div className="af-model-specs t-meta">
                      <span>Context: {model.capabilities.contextSize.toLocaleString()}</span>
                      <span>Output: {model.capabilities.maxOutputTokens.toLocaleString()}</span>
                      <span>Knowledge: {model.capabilities.knowledgeCutoff}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
          {selectedModel?.capabilities.supportsTemperature && (
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

          {selectedModel?.capabilities.reasoning && (
            <div className="af-slider-field">
              <div className="af-label-row">
                <label className="af-label t-label">{t('assistants.form.reasoningEffort')}</label>
                <span className="af-char-count t-meta">{t(`assistants.form.reasoningLevels.${(formData.reasoningEffort || 'None').toLowerCase()}`)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={['None', 'Low', 'Medium', 'High'].indexOf(formData.reasoningEffort || 'None')}
                onChange={(e) => {
                  const levels: ReasoningEffort[] = ['None', 'Low', 'Medium', 'High'];
                  handleChange('reasoningEffort', levels[parseInt(e.target.value)]);
                }}
                className="af-slider"
                disabled={loading}
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
