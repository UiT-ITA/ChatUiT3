import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdEdit, MdDelete, MdShare, MdVisibility, MdVisibilityOff, MdImage, MdPublic, MdPsychology } from 'react-icons/md';
import type { PrivateAssistantDto, SystemAssistantDto, SharedAssistantDto } from '../../types/assistantModels';
import { useSignals } from '@preact/signals-react/runtime';
import { getModels } from '../../services/modelService';
import type { UserModelDto } from '../../types/modelModels';
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
  const { t } = useTranslation();
  useSignals();
  const modelsSignal = getModels();
  const models: UserModelDto[] = modelsSignal.value ?? [];

  const modelResolved = models.find(m => m.id === (assistant as any).modelId);

  const capabilities = {
    vision: !!modelResolved?.capabilities.vision,
    tools: !!modelResolved?.capabilities.tools,
    reasoning: !!modelResolved?.capabilities.reasoning,
  };

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
              title={assistant.isVisible ? t('assistants.actions.hideFromSelector') : t('assistants.actions.showInSelector')}
            >
              {assistant.isVisible ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />}
            </button>
          )}
          
          {variant === 'owned' && onShare && (
            <button
              onClick={() => onShare(assistant as PrivateAssistantDto)}
              className="assistant-card-button"
              title={t('assistants.actions.shareAssistant')}
            >
              <MdShare size={20} />
            </button>
          )}
          
          {variant === 'owned' && onEdit && (
            <button
              onClick={() => onEdit(assistant as PrivateAssistantDto)}
              className="assistant-card-button"
              title={t('assistants.actions.editAssistant')}
            >
              <MdEdit size={20} />
            </button>
          )}
          
          {variant === 'owned' && onDelete && (
            <button
              onClick={() => onDelete(assistant.id)}
              className="assistant-card-button danger"
              title={t('assistants.actions.deleteAssistant')}
            >
              <MdDelete size={20} />
            </button>
          )}
        </div>
      </div>
      
      <div className="assistant-card-meta">
        <div className="assistant-card-footer">
          <div className="assistant-capabilities">
            {renderCapabilityIcon(capabilities.vision, <MdImage size={16} />, t('assistants.capabilities.vision'))}
            {renderCapabilityIcon(capabilities.tools, <MdPublic size={16} />, t('assistants.capabilities.tools'))}
            {renderCapabilityIcon(capabilities.reasoning, <MdPsychology size={16} />, t('assistants.capabilities.reasoning'))}
          </div>
          {variant === 'shared' && (assistant as SharedAssistantDto).createdBy && (
            <div className="assistant-creator">
              {t('assistants.createdBy')} {(assistant as SharedAssistantDto).createdBy}
            </div>
          )}
          <div className="assistant-card-model">
            {modelResolved?.modelName || ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantCard;
