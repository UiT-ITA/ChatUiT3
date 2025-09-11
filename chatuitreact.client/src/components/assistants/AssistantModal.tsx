import React, { useState, useRef, useEffect } from 'react';
import { MdImage, MdPublic, MdPsychology, MdExpandMore, MdExpandLess, MdPerson, MdSettings, MdTune, MdLibraryBooks } from 'react-icons/md';
import { useSignals } from '@preact/signals-react/runtime';
import type { CreateAssistantDto, PrivateAssistantDto, ReasoningEffort, ChatToolDto } from '../../types/assistantModels';
import { getModels } from '../../services/modelService';
import { getTools } from '../../services/toolService';
import { enhanceModelsWithCapabilities, type EnhancedModel } from '../../utils/modelUtils';
import { createAssistant, updateAssistant } from '../../services/assistantService';
import TagField from '../common/TagField';
import './AssistantModal.css';

type SectionType = 'details' | 'model' | 'settings' | 'background';

interface AssistantModalProps {
  isOpen: boolean;
  editingAssistant: PrivateAssistantDto | null;
  onClose: () => void;
}

const AssistantModal: React.FC<AssistantModalProps> = ({
  isOpen,
  editingAssistant,
  onClose
}) => {
  useSignals();
  const modelsSignal = getModels();
  const toolsSignal = getTools();
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<SectionType>('details');
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

  // Enhanced models
  const models: EnhancedModel[] = modelsSignal.value ? enhanceModelsWithCapabilities(modelsSignal.value) : [];
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
        modelId: editingAssistant.model.id,
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

    setLoading(true);
    try {
      if (editingAssistant) {
        await updateAssistant({
          id: editingAssistant.id,
          ...formData
        });
      } else {
        await createAssistant(formData);
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
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            {editingAssistant ? 'Edit Assistant' : 'Create Assistant'}
          </h2>
        </div>
        
        <div className="modal-body accordion-container">
          {/* Details Section */}
          <div className={`accordion-section ${activeSection === 'details' ? 'active' : ''}`}>
            <button
              type="button"
              className={`accordion-header ${activeSection === 'details' ? 'active' : ''}`}
              onClick={() => setActiveSection('details')}
              disabled={loading}
            >
              <div className="accordion-header-content">
                <MdPerson size="20px" />
                <span>Details</span>
              </div>
              {activeSection === 'details' ? <MdExpandLess size="20px" /> : <MdExpandMore size="20px" />}
            </button>
            {activeSection === 'details' && (
              <div className="accordion-content">
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="form-input"
                    placeholder="Enter assistant name"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="form-textarea"
                    placeholder="Enter description (optional)"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tags</label>
                  <TagField
                    tags={formData.tags || []}
                    onChange={(tags) => handleChange('tags', tags)}
                    placeholder="Add tags..."
                    disabled={loading}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Model Section */}
          <div className={`accordion-section ${activeSection === 'model' ? 'active' : ''}`}>
            <button
              type="button"
              className={`accordion-header ${activeSection === 'model' ? 'active' : ''}`}
              onClick={() => setActiveSection('model')}
              disabled={loading}
            >
              <div className="accordion-header-content">
                <MdTune size="20px" />
                <span>Model</span>
              </div>
              {activeSection === 'model' ? <MdExpandLess size="20px" /> : <MdExpandMore size="20px" />}
            </button>
            {activeSection === 'model' && (
              <div className="accordion-content">
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
                        {selectedModel ? selectedModel.displayName : 'Select a model'}
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
                              <span className="model-name">{model.displayName}</span>
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
                        <strong>{selectedModel.displayName}</strong>
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
              </div>
            )}
          </div>

          {/* Settings Section */}
          <div className={`accordion-section ${activeSection === 'settings' ? 'active' : ''}`}>
            <button
              type="button"
              className={`accordion-header ${activeSection === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveSection('settings')}
              disabled={loading}
            >
              <div className="accordion-header-content">
                <MdSettings size="20px" />
                <span>Settings</span>
              </div>
              {activeSection === 'settings' ? <MdExpandLess size="20px" /> : <MdExpandMore size="20px" />}
            </button>
            {activeSection === 'settings' && (
              <div className="accordion-content">
                <div className="form-group">
                  <label className="form-label">Available Tools</label>
                  {availableTools.length > 0 ? (
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
                  )}
                </div>

                <div className="form-row">
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
              </div>
            )}
          </div>

          {/* Background Knowledge Section */}
          <div className={`accordion-section ${activeSection === 'background' ? 'active' : ''}`}>
            <button
              type="button"
              className={`accordion-header ${activeSection === 'background' ? 'active' : ''}`}
              onClick={() => setActiveSection('background')}
              disabled={loading}
            >
              <div className="accordion-header-content">
                <MdLibraryBooks size="20px" />
                <span>Background Knowledge</span>
              </div>
              {activeSection === 'background' ? <MdExpandLess size="20px" /> : <MdExpandMore size="20px" />}
            </button>
            {activeSection === 'background' && (
              <div className="accordion-content">
                <div className="empty-section">
                  <p>Background knowledge features are not yet implemented.</p>
                  <p>This section will allow you to provide additional context and knowledge sources for your assistant.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="button secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="button primary"
            disabled={!formData.name.trim() || !formData.modelId || loading}
          >
            {loading ? 'Saving...' : (editingAssistant ? 'Update' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantModal;
