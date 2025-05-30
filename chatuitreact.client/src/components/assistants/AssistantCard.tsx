import React from 'react';
import { MdEdit, MdDelete, MdShare, MdVisibility, MdVisibilityOff } from 'react-icons/md';
import { AnyAssistantDto, PrivateAssistantDto } from '../../types/dtos';

interface AssistantCardProps {
  assistant: AnyAssistantDto;
  variant: 'owned' | 'system' | 'shared';
  onToggleFavorite: (id: string) => void;
  onShare?: (assistant: PrivateAssistantDto) => void;
  onEdit?: (assistant: PrivateAssistantDto) => void;
  onDelete?: (id: string) => void;
}

const AssistantCard: React.FC<AssistantCardProps> = ({
  assistant,
  variant,
  onToggleFavorite,
  onShare,
  onEdit,
  onDelete
}) => {
  const getModelName = () => {
    if ('modelName' in assistant) {
      return assistant.modelName;
    }
    return assistant.model.modelName;
  };

  return (
    <div className="assistant-card">
      <div className="assistant-card-header">
        <div>
          <h3 className="assistant-card-title">{assistant.name}</h3>
          <p className="assistant-card-description">{assistant.description}</p>
        </div>
        <div className="assistant-card-actions">
          <button
            onClick={() => onToggleFavorite(assistant.id)}
            className={`assistant-card-button favorite ${assistant.isVisible ? 'active' : ''}`}
            title={assistant.isVisible ? 'Hide from selector' : 'Show in selector'}
          >
            {assistant.isVisible ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />}
          </button>
          
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
        <div className="assistant-card-tags">
          <span className={`assistant-type-badge ${variant}`}>
            {variant.toUpperCase()}
          </span>
          {assistant.tags.map((tag, index) => (
            <span key={index} className="assistant-tag">
              {tag}
            </span>
          ))}
        </div>
        <div className="assistant-card-model">
          {getModelName()}
        </div>
      </div>
    </div>
  );
};

export default AssistantCard;
