import React, { useState, useRef, useEffect } from 'react';
import { MdImage, MdPublic, MdPsychology, MdExpandMore, MdExpandLess } from 'react-icons/md';
import { CreateAssistantDto, PrivateAssistantDto, ReasoningEffort } from '../../types/dtos';
import { EnhancedModel } from '../../utils/modelUtils';
import './AssistantModals.css';

interface AssistantModalProps {
  isOpen: boolean;
  editingAssistant: PrivateAssistantDto | null;
  formData: CreateAssistantDto;
  models: EnhancedModel[];
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: (data: CreateAssistantDto) => void;
}

const AssistantModal: React.FC<AssistantModalProps> = ({
  isOpen,
  editingAssistant,
  formData,
  models,
  onClose,
  onSubmit,
  onFormChange
}) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Get the currently selected model
  const selectedModel = models.find(m => m.id === formData.modelId);

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

  const handleChange = (field: string, value: any) => {
    onFormChange({ ...formData, [field]: value });
  };

  const handleModelChange = (modelId: string) => {
    const newModel = models.find(m => m.id === modelId);
    
    // If switching to a non-reasoning model, reset reasoning effort to None
    if (newModel && !newModel.capabilities.reasoning && formData.reasoningEffort !== ReasoningEffort.None) {
      onFormChange({
        ...formData,
        modelId,
        reasoningEffort: ReasoningEffort.None
      });
    } else {
      handleChange('modelId', modelId);
    }
    setIsModelDropdownOpen(false);
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
        
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="form-input"
              placeholder="Enter assistant name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="form-textarea"
              placeholder="Describe what this assistant does"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Tags (comma separated)</label>
            <input
              type="text"
              value={formData.tags.join(', ')}
              onChange={(e) => handleChange('tags', e.target.value.split(',').map(t => t.trim()).filter(t => t))}
              className="form-input"
              placeholder="coding, helper, creative"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Model</label>
            <div className="custom-dropdown" ref={modelDropdownRef}>
              <button
                type="button"
                className="custom-dropdown-button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              >
                <span className="dropdown-text">
                  {selectedModel ? selectedModel.displayName : 'Select a model...'}
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
              placeholder="You are a helpful assistant that..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Temperature</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Reasoning Effort
                {selectedModel && !selectedModel.capabilities.reasoning && (
                  <span className="disabled-reason"> (Model does not support reasoning)</span>
                )}
              </label>
              <select
                value={formData.reasoningEffort}
                onChange={(e) => handleChange('reasoningEffort', e.target.value as ReasoningEffort)}
                className="form-select"
                disabled={selectedModel && !selectedModel.capabilities.reasoning}
                title={selectedModel && !selectedModel.capabilities.reasoning ? 'This model does not support reasoning' : ''}
              >
                <option value={ReasoningEffort.None}>None</option>
                <option value={ReasoningEffort.Low}>Low</option>
                <option value={ReasoningEffort.Medium}>Medium</option>
                <option value={ReasoningEffort.High}>High</option>
              </select>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="button secondary"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="button primary"
          >
            {editingAssistant ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantModal;
