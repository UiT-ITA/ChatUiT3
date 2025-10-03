import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { getSelectableAssistants, getCurrentAssistantId, setUserSelectedAssistantId } from '../../services/chatService';
import { getModels } from '../../services/modelService';
import type { AssistantDto } from '../../types/assistantModels';
import type { UserModelDto } from '../../types/modelModels';
import './AssistantDropdown.css';

interface AssistantDropdownProps {
  isOpen: boolean;
  direction: 'above' | 'below';
  onClose?: () => void;
}

export default function AssistantDropdown({ isOpen, direction, onClose }: AssistantDropdownProps) {
  useSignals();
  const { t } = useTranslation();

  const selectableAssistants = getSelectableAssistants().value || [];
  const currentAssistantId = getCurrentAssistantId().value;
  const selectedAssistant = selectableAssistants.find(a => a.id === currentAssistantId) || selectableAssistants[0];

  const modelsSignal = getModels();
  const models: UserModelDto[] = modelsSignal.value ?? [];

  const handleSelectAssistant = (assistant: AssistantDto) => {
    setUserSelectedAssistantId(assistant.id);
    if (onClose) {
      onClose();
    }
  };

  const renderCapabilityIcon = (capability: string, enabled: boolean) => {
    if (!enabled) return null;
    
    const iconProps = {
      size: 1,
      className: "capability-icon"
    };
    
    switch (capability) {
      case 'vision':
        return <Icon key="vision" name="eye" {...iconProps} title={t('assistants.capabilities.vision')} />;
      case 'tools':
        return <Icon key="tools" name="globe" {...iconProps} title={t('assistants.capabilities.tools')} />;
      case 'reasoning':
        return <Icon key="reasoning" name="brain" {...iconProps} title={t('assistants.capabilities.reasoning')} />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  const dropdownClass = direction === 'above' ? 'assistant-dropdown-above' : 'assistant-dropdown-below';

  return (
    <div className={`assistant-dropdown ${dropdownClass}`}>
      {selectableAssistants.map((assistant) => {
        const modelResolved = models.find(m => m.id === (assistant as any).modelId);
        const capabilities = {
          vision: !!modelResolved?.capabilities.vision,
          tools: !!modelResolved?.capabilities.tools,
          reasoning: !!modelResolved?.capabilities.reasoning,
        };
        
        return (
          <div 
            key={assistant.id}
            className={`assistant-option ${selectedAssistant?.id === assistant.id ? 'selected' : ''}`}
            onClick={() => handleSelectAssistant(assistant)}
          >
            <div className="assistant-info">
              <span className="assistant-option-name">{assistant.name}</span>
              {assistant.type === 'system' && (
                <span className="system-badge">{t('assistants.systemBadge')}</span>
              )}
              <div className="info-tooltip-container">
                <Icon 
                  name="info" 
                  size={1} 
                  className="info-icon" 
                />
                <div className="info-tooltip">{assistant.description || t('assistants.noDescriptionAvailable')}</div>
              </div>
            </div>
            <div className="assistant-capabilities">
              {renderCapabilityIcon('vision', capabilities.vision)}
              {renderCapabilityIcon('tools', capabilities.tools)}
              {renderCapabilityIcon('reasoning', capabilities.reasoning)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
