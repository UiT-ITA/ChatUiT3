import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { Icon } from './Icon';
import { getSelectableAssistants, getCurrentAssistantId, setUserSelectedAssistantId } from '../../services/chatService';
import { getAssistantCapabilities } from '../../utils/modelUtils';
import type { AssistantDto } from '../../models/assistantModels';
import './AssistantSelector.css';

interface AssistantSelectorProps {
  className?: string;
}

export default function AssistantSelector({ className }: AssistantSelectorProps) {
  useSignals();
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  const selectableAssistants = getSelectableAssistants().value || [];
  const currentAssistantId = getCurrentAssistantId().value;
  const selectedAssistant = selectableAssistants.find(a => a.id === currentAssistantId) || selectableAssistants[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleSelectAssistant = (assistant: AssistantDto) => {
    setUserSelectedAssistantId(assistant.id);
    setIsOpen(false);
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

  return (
    <div className={`assistant-selector-container ${className || ''}`} ref={selectorRef}>
      <button 
        type="button"
        className="assistant-selector-button"
        onClick={toggleDropdown}
        title="Select AI assistant"
      >
        <div className="assistant-icon">
          <Icon name="assistants" size={1.75} className="icon" />
        </div>
        <span className="assistant-name">{selectedAssistant?.name || 'Assistant'}</span>
        <Icon 
          name={isOpen ? "arrowDown" : "arrowUp"} 
          size={1.25} 
          className="expand-icon"
        />
      </button>

      {isOpen && (
        <div className="assistant-dropdown">
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
      )}
    </div>
  );
}
