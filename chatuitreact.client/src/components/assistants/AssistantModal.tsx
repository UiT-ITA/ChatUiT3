import React, { useState, useRef, useEffect } from 'react';
import { MdImage, MdPublic, MdPsychology, MdExpandMore, MdExpandLess } from 'react-icons/md';
import { CreateAssistantDto, PrivateAssistantDto, ReasoningEffort } from '../../types/dtos';
import { EnhancedModel } from '../../utils/modelUtils';
import './AssistantModals.css';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();

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
            {editingAssistant ? t('assistants.editAssistantTitle') : t('assistants.createAssistantTitle')}  
          </h2>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">{t('common.name')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="form-input"
              placeholder={t('assistants.namePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('assistants.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="form-textarea"
              placeholder={t('assistants.descriptionPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('assistants.tags')}</label>
            <input
              type="text"
              value={formData.tags.join(', ')}
              onChange={(e) => handleChange('tags', e.target.value.split(',').map(t => t.trim()).filter(t => t))}
              className="form-input"
              placeholder={t('assistants.tagsPlaceholder')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('assistants.model')}</label>
            <div className="custom-dropdown" ref={modelDropdownRef}>
              <button
                type="button"
                className="custom-dropdown-button"
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              >
                <span className="dropdown-text">
                  {selectedModel ? selectedModel.displayName : t('assistants.modelPlaceholder')}
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
                        <span>{t('assistants.modelContext')}: {model.capabilities.contextSize.toLocaleString()}</span>
                        <span>{t('assistants.modelOutput')}: {model.capabilities.maxOutputTokens.toLocaleString()}</span>
                        <span>{t('assistants.modelKnowledge')}: {model.capabilities.knowledgeCutoff}</span>
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
            <label className="form-label">{t('assistants.systemPrompt')}</label>
            <textarea
              value={formData.systemPrompt}
              onChange={(e) => handleChange('systemPrompt', e.target.value)}
              className="form-textarea large"
              placeholder={t('assistants.systemPromptPlaceholder')}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('assistants.temperature')}</label>
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
                {t('assistants.reasoning')}
                {selectedModel && !selectedModel.capabilities.reasoning && (
                  <span className="disabled-reason"> ({t('assistants.reasoningNotSupported')})</span>
                )}
              </label>
              <select
                value={formData.reasoningEffort}
                onChange={(e) => handleChange('reasoningEffort', e.target.value as ReasoningEffort)}
                className="form-select"
                disabled={selectedModel && !selectedModel.capabilities.reasoning}
                title={selectedModel && !selectedModel.capabilities.reasoning ? t('assistants.reasoningNotSupported') : ''}
              >
                <option value={ReasoningEffort.None}>{t('assistants.reasoningNone')}</option>
                <option value={ReasoningEffort.Low}>{t('assistants.reasoningLow')}</option>
                <option value={ReasoningEffort.Medium}>{t('assistants.reasoningMedium')}</option>
                <option value={ReasoningEffort.High}>{t('assistants.reasoningHigh')}</option>
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
