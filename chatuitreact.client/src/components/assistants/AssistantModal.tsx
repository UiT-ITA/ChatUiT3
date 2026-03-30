import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MdImage, MdPublic, MdPsychology, MdExpandMore, MdExpandLess } from 'react-icons/md';
import { useSignals } from '@preact/signals-react/runtime';
import type { CreateAssistantDto, FullAssistantDto, ReasoningEffort, ChatToolDto, UpdateAssistantDto } from '../../types/assistantModels';
import { getModels } from '../../services/modelService';
import { getTools } from '../../services/toolService';
import type { UserModelDto } from '../../types/modelModels';
import { createAssistant, updateAssistant } from '../../services/assistantService';
import { Dialog, DialogPage, DialogButton } from '../common/Dialog';
import TagField from '../common/TagField';
import './AssistantModal.css';

interface AssistantModalProps {
  isOpen: boolean;
  editingAssistant: FullAssistantDto | null;
  onClose: () => void;
  onCreate?: (assistant: CreateAssistantDto) => Promise<unknown>;
  onUpdate?: (assistant: UpdateAssistantDto) => Promise<unknown>;
  createTitle?: string;
  editTitle?: string;
}

const AssistantModal: React.FC<AssistantModalProps> = ({
  isOpen,
  editingAssistant,
  onClose,
  onCreate,
  onUpdate,
  createTitle,
  editTitle
}) => {
  useSignals();
  const { t } = useTranslation();
  const modelsSignal = getModels();
  const toolsSignal = getTools();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [systemPromptSnippets, setSystemPromptSnippets] = useState({
    renderMarkdown: false,
    includeBasicInfo: false,
    renderEquations: false
  });
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formData, setFormData] = useState<CreateAssistantDto>({
    name: '',
    description: '',
    tags: [],
    modelId: '',
    systemPrompt: '',
    temperature: 0.7,
    reasoningEffort: 'None'
  });

  // Models from server (already include capabilities and description)
  const models: UserModelDto[] = modelsSignal.value ?? [];
  const selectedModel = models.find(m => m.id === formData.modelId);
  
  // Available tools from service
  const availableTools: ChatToolDto[] = toolsSignal.value || [];

  // Initialize form data when editing
  useEffect(() => {
    if (editingAssistant) {
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
  }, [editingAssistant, isOpen]);

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

  const handleChange = (field: keyof CreateAssistantDto, value: any) => {
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
    let newSelectedIds: string[];
    if (isSelected) {
      newSelectedIds = [...selectedToolIds, toolId];
    } else {
      newSelectedIds = selectedToolIds.filter(id => id !== toolId);
    }
    
    setSelectedToolIds(newSelectedIds);
    handleChange('availableToolIds', newSelectedIds);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.modelId || loading) return;

    // Normalize unsupported params on submit
    const normalized: CreateAssistantDto = { ...formData };
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
      onClose();
    } catch (error) {
      console.error('Failed to save assistant:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCapabilityIcon = (capability: string, enabled: boolean, icon: React.ReactNode) => {
    if (!enabled) return null;
    
    return (
      <span key={capability} className="model-capability-icon" title={capability}>
        {icon}
      </span>
    );
  };

  const renderCapabilityBadge = (capability: string, enabled: boolean, icon: React.ReactNode) => {
    if (!enabled) return null;
    
    return (
      <div key={capability} className="capability-badge" title={capability}>
        {icon}
        <span>{capability}</span>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={editingAssistant ? (editTitle ?? t('assistants.editAssistant')) : (createTitle ?? t('assistants.createAssistant'))}
      size="large"
    >
      {/* Details Page */}
      <DialogPage id="details" label="Details" icon="user">
        <div className="form-group">
          <label className="form-label">{t('assistants.form.name')}</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="form-input"
            placeholder={t('assistants.form.namePlaceholder')}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('assistants.form.description')}</label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="form-textarea"
            placeholder={t('assistants.form.description')}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t('assistants.form.tags')}</label>
          <TagField
            tags={formData.tags || []}
            onChange={(tags) => handleChange('tags', tags)}
            placeholder={t('assistants.form.tagsPlaceholder')}
            disabled={loading}
          />
        </div>
      </DialogPage>

      {/* Model Page */}
      <DialogPage id="model" label="Model" icon="brain">
        <div className="form-group">
          <label className="form-label">Model</label>
          <div className="custom-dropdown" ref={modelDropdownRef}>
            <button
              type="button"
              className="custom-dropdown-button"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              disabled={loading}
            >
              <span className="dropdown-text">
                    {selectedModel ? selectedModel.modelName : 'Select a model'}
              </span>
              {isModelDropdownOpen ? <MdExpandLess size="20px" /> : <MdExpandMore size="20px" />}
            </button>
            
            {isModelDropdownOpen && (
              <div className="custom-dropdown-list">
                {models.map(model => (
                  <div
                    key={model.id}
                    className={`model-option ${formData.modelId === model.id ? 'selected' : ''}`}
                    onClick={() => handleModelChange(model.id)}
                  >
                    <div className="model-option-header">
                      <span className="model-name">{model.modelName}</span>
                      <div className="model-capabilities-inline">
                        {renderCapabilityIcon('Vision', model.capabilities.vision, <MdImage size="16px" />)}
                        {renderCapabilityIcon('Tools', model.capabilities.tools, <MdPublic size="16px" />)}
                        {renderCapabilityIcon('Reasoning', model.capabilities.reasoning, <MdPsychology size="16px" />)}
                      </div>
                    </div>
                    <div className="model-description-inline">{model.description}</div>
                    <div className="model-specs-inline">
                      <span>Context: {model.capabilities.contextSize.toLocaleString()}</span>
                      <span>Output: {model.capabilities.maxOutputTokens.toLocaleString()}</span>
                      <span>Knowledge: {model.capabilities.knowledgeCutoff}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {selectedModel && (
            <div className="selected-model-info">
              <div className="selected-model-summary">
                <strong>{selectedModel.modelName}</strong>
                <div className="model-capabilities">
                  {renderCapabilityBadge('Vision', selectedModel.capabilities.vision, <MdImage size="16px" />)}
                  {renderCapabilityBadge('Tools', selectedModel.capabilities.tools, <MdPublic size="16px" />)}
                  {renderCapabilityBadge('Reasoning', selectedModel.capabilities.reasoning, <MdPsychology size="16px" />)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">System Prompt</label>
          <textarea
            value={formData.systemPrompt}
            onChange={(e) => handleChange('systemPrompt', e.target.value)}
            className="form-textarea large"
            placeholder="Enter system prompt (optional)"
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">System Prompt Snippets</label>
          <div className="snippet-selection">
            <label className="snippet-checkbox-label">
              <input
                type="checkbox"
                checked={systemPromptSnippets.renderMarkdown}
                onChange={(e) => setSystemPromptSnippets(prev => ({ ...prev, renderMarkdown: e.target.checked }))}
                disabled={loading}
              />
              <span>Render in markdown</span>
            </label>
            <label className="snippet-checkbox-label">
              <input
                type="checkbox"
                checked={systemPromptSnippets.includeBasicInfo}
                onChange={(e) => setSystemPromptSnippets(prev => ({ ...prev, includeBasicInfo: e.target.checked }))}
                disabled={loading}
              />
              <span>Include basic info about you</span>
            </label>
            <label className="snippet-checkbox-label">
              <input
                type="checkbox"
                checked={systemPromptSnippets.renderEquations}
                onChange={(e) => setSystemPromptSnippets(prev => ({ ...prev, renderEquations: e.target.checked }))}
                disabled={loading}
              />
              <span>Render equations</span>
            </label>
          </div>
        </div>
      </DialogPage>

      {/* Settings Page */}
      <DialogPage id="settings" label="Settings" icon="settings">
        <div className="form-group">
          <label className="form-label">Available Tools</label>
          {selectedModel?.capabilities.tools ? (
            availableTools.length > 0 ? (
              <div className="tools-selection">
                {availableTools.map(tool => (
                  <div key={tool.id} className="tool-option">
                    <label className="tool-checkbox-label">
                      <input
                        type="checkbox"
                        checked={selectedToolIds.includes(tool.id)}
                        onChange={(e) => handleToolSelection(tool.id, e.target.checked)}
                        disabled={loading}
                      />
                      <div className="tool-info">
                        <span className="tool-name">{tool.name}</span>
                        <span className="tool-description">{tool.description}</span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-tools-message">
                No tools available
              </div>
            )
          ) : (
            <div className="no-tools-message">
              This model does not support tools
            </div>
          )}
        </div>

        <div className="form-row">
          {selectedModel?.capabilities.supportsTemperature && (
            <div className="form-group">
              <label className="form-label">Temperature</label>
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                  className="form-slider"
                  disabled={loading}
                />
                <span className="slider-value">{formData.temperature}</span>
              </div>
            </div>
          )}

          {selectedModel?.capabilities.reasoning && (
            <div className="form-group">
              <label className="form-label">Reasoning Effort</label>
              <div className="slider-container">
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
                  className="form-slider"
                  disabled={loading}
                />
                <span className="slider-value">{formData.reasoningEffort}</span>
              </div>
            </div>
          )}
        </div>
      </DialogPage>

      {/* Knowledge Page */}
      <DialogPage id="knowledge" label="Knowledge" icon="help">
        <div className="empty-section">
          <p>Background knowledge features are not yet implemented.</p>
          <p>This section will allow you to provide additional context and knowledge sources for your assistant.</p>
        </div>
      </DialogPage>

      {/* Action Buttons */}
      <DialogButton
        variant="secondary"
        onClick={onClose}
        disabled={loading}
      >
        {t('common.cancel')}
      </DialogButton>
      
      <DialogButton
        variant="primary"
        onClick={handleSubmit}
        disabled={!formData.name.trim() || !formData.modelId || loading}
      >
        {loading ? t('assistants.saving') : (editingAssistant ? t('assistants.update') : t('common.create'))}
      </DialogButton>
    </Dialog>
  );
};

export default AssistantModal;
