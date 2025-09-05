import { useSignals } from '@preact/signals-react/runtime';
import { Icon } from './Icon';
import { getSelectableAssistants, getCurrentAssistantId, setUserSelectedAssistantId } from '../../services/chatService';
import { getAssistantCapabilities } from '../../utils/modelUtils';
import type { AssistantDto } from '../../types/assistantModels';
import './AssistantDropdown.css';

interface AssistantDropdownProps {
  isOpen: boolean;
  direction: 'above' | 'below';
  onClose?: () => void;
}

export default function AssistantDropdown({ isOpen, direction, onClose }: AssistantDropdownProps) {
  useSignals();

  const selectableAssistants = getSelectableAssistants().value || [];
  const currentAssistantId = getCurrentAssistantId().value;
  const selectedAssistant = selectableAssistants.find(a => a.id === currentAssistantId) || selectableAssistants[0];

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
        return <Icon key="vision" name="eye" {...iconProps} title="Vision" />;
      case 'tools':
        return <Icon key="tools" name="globe" {...iconProps} title="Tools" />;
      case 'reasoning':
        return <Icon key="reasoning" name="brain" {...iconProps} title="Reasoning" />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  const dropdownClass = direction === 'above' ? 'assistant-dropdown-above' : 'assistant-dropdown-below';

  return (
    <div className={`assistant-dropdown ${dropdownClass}`}>
      {selectableAssistants.map((assistant) => {
        const capabilities = getAssistantCapabilities(assistant);
        
        return (
          <div 
            key={assistant.id}
            className={`assistant-option ${selectedAssistant?.id === assistant.id ? 'selected' : ''}`}
            onClick={() => handleSelectAssistant(assistant)}
          >
            <div className="assistant-info">
              <span className="assistant-option-name">{assistant.name}</span>
              {assistant.type === 'system' && (
                <span className="system-badge">System</span>
              )}
              <div className="info-tooltip-container">
                <Icon 
                  name="info" 
                  size={1} 
                  className="info-icon" 
                />
                <div className="info-tooltip">{assistant.description || 'No description available'}</div>
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
