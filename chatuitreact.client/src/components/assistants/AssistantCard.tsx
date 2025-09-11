import React from 'react';
import { MdEdit, MdDelete, MdShare, MdVisibility, MdVisibilityOff, MdImage, MdPublic, MdPsychology } from 'react-icons/md';
import type { PrivateAssistantDto, SystemAssistantDto, SharedAssistantDto } from '../../types/assistantModels';
import { getAssistantCapabilities, getModelNameFromAssistant } from '../../utils/modelUtils';
import TagField from '../common/TagField';
import './AssistantCard.css';

type AssistantType = PrivateAssistantDto | SystemAssistantDto | SharedAssistantDto;

interface AssistantCardProps {
  assistant: AssistantType;
  variant: 'owned' | 'system' | 'shared';
  isDefault?: boolean;
  onToggleFavorite: (id: string) => void;
  onShare?: (assistant: PrivateAssistantDto) => void;
  onEdit?: (assistant: PrivateAssistantDto) => void;
  onDelete?: (id: string) => void;
}

const AssistantCard: React.FC<AssistantCardProps> = ({
  assistant,
  variant,
  isDefault = false,
  onToggleFavorite,
  onShare,
  onEdit,
  onDelete
}) => {
  const modelName = getModelNameFromAssistant(assistant);
  const capabilities = getAssistantCapabilities(assistant);

  const renderCapabilityIcon = (enabled: boolean, icon: React.ReactNode, title: string) => {
    if (!enabled) return null;
    return (
      <span className="capability-icon" title={title}>
        {icon}
      </span>
    );
  };

  return (
    <div className="assistant-card">
      <div className="assistant-card-header">
        <div className="assistant-card-info">
          <div className="assistant-card-title-row">
            <h3 className="assistant-card-title">{assistant.name}</h3>
            <TagField
              tags={assistant.tags}
              readonly={true}
            />
          </div>
          <p className="assistant-card-description">{assistant.description}</p>
        </div>
        
        <div className="assistant-card-actions">
          {!isDefault && (
            <button
              onClick={() => onToggleFavorite(assistant.id)}
              className={`assistant-card-button ${assistant.isVisible ? 'active' : ''}`}
              title={assistant.isVisible ? 'Hide from selector' : 'Show in selector'}
            >
              {assistant.isVisible ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />}
            </button>
          )}
          
          {variant === 'owned' && onShare && (
            <button
              onClick={() => onShare(assistant as PrivateAssistantDto)}
              className="assistant-card-button"
              title="Share assistant"
            >
              <MdShare size={20} />
            </button>
          )}
          
          {variant === 'owned' && onEdit && (
            <button
              onClick={() => onEdit(assistant as PrivateAssistantDto)}
              className="assistant-card-button"
              title="Edit assistant"
            >
              <MdEdit size={20} />
            </button>
          )}
          
          {variant === 'owned' && onDelete && (
            <button
              onClick={() => onDelete(assistant.id)}
              className="assistant-card-button danger"
              title="Delete assistant"
            >
              <MdDelete size={20} />
            </button>
          )}
        </div>
      </div>
      
      <div className="assistant-card-meta">
        <div className="assistant-card-footer">
          <div className="assistant-capabilities">
            {renderCapabilityIcon(capabilities.vision, <MdImage size={16} />, 'Vision')}
            {renderCapabilityIcon(capabilities.tools, <MdPublic size={16} />, 'Tools')}
            {renderCapabilityIcon(capabilities.reasoning, <MdPsychology size={16} />, 'Reasoning')}
          </div>
          <div className="assistant-card-model">{modelName}</div>
        </div>
      </div>
    </div>
  );
};

export default AssistantCard;
