import React, { useState, useRef, useEffect } from 'react';
import { MdExpandMore, MdExpandLess, MdInfo, MdImage, MdPublic, MdPsychology } from 'react-icons/md';
import type { AnyAssistantDto } from '../../types/dtos';
import { getAssistantCapabilities, AssistantCapabilities } from '../../utils/modelUtils';
import './AssistantSelector.css';
import { useTranslation } from 'react-i18next';

interface AssistantSelectorProps {
  assistants: AnyAssistantDto[];
  selectedAssistantId: string | undefined;
  onSelectAssistant: (assistantId: string) => void;
}

const AssistantSelector: React.FC<AssistantSelectorProps> = ({
  assistants,
  selectedAssistantId,
  onSelectAssistant
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  // Find the currently selected assistant
  const selectedAssistant = selectedAssistantId 
    ? assistants.find(a => a.id === selectedAssistantId) 
    : assistants[0];

  // Close dropdown when clicking outside
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

  const handleSelectAssistant = (assistantId: string) => {
    onSelectAssistant(assistantId);
    setIsOpen(false);
  };

  // Helper function to check if assistant is a system assistant
  const isSystemAssistant = (assistant: AnyAssistantDto): boolean => {
    return 'modelName' in assistant && !('model' in assistant);
  };

  // Render capability icon based on type
  const renderCapabilityIcon = (capability: keyof AssistantCapabilities, enabled: boolean) => {
    if (!enabled) return null;
    
    switch (capability) {
      case 'vision':
        return <MdImage key="vision" size="16px" title="Vision" className="capability-icon" />;
      case 'tools':
        return <MdPublic key="tools" size="16px" title="Tools" className="capability-icon" />;
      case 'reasoning':
        return <MdPsychology key="reasoning" size="16px" title="Reasoning" className="capability-icon" />;
      default:
        return null;
    }
  };

  return (
    <div className="assistant-selector-container" ref={selectorRef}>
      <button 
        className="assistant-selector-button"
        onClick={toggleDropdown}
        title="Select AI assistant"
      >
        {selectedAssistant ? (
          <>
            <span className="assistant-name">{selectedAssistant.name}</span>
            {isOpen ? <MdExpandLess size="20px" /> : <MdExpandMore size="20px" />}
          </>
        ) : (
          <>
            <span className="assistant-name">Select Assistant</span>
            {isOpen ? <MdExpandLess size="20px" /> : <MdExpandMore size="20px" />}
          </>
        )}
      </button>

      {isOpen && (
        <div className="assistant-dropdown">
          {assistants.map((assistant) => {
            const capabilities = getAssistantCapabilities(assistant);
            
            return (
              <div 
                key={assistant.id}
                className={`assistant-option ${selectedAssistantId === assistant.id ? 'selected' : ''}`}
                onClick={() => handleSelectAssistant(assistant.id)}
              >
                <div className="assistant-info">
                  <span className="assistant-option-name">{assistant.name}</span>
                  <div className="info-tooltip-container">
                    <MdInfo 
                      size="16px" 
                      className="info-icon" 
                      onMouseEnter={(e) => {
                        const tooltip = e.currentTarget.nextElementSibling as HTMLElement;
                        if (tooltip) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          tooltip.style.top = `${rect.top - 5}px`;
                          tooltip.style.left = `${rect.right + 5}px`;
                        }
                      }}
                    />
                    <div className="info-tooltip">{assistant.description}</div>
                  </div>
                </div>
                <div className="assistant-capabilities">
                  {renderCapabilityIcon('vision', capabilities.vision)}
                  {renderCapabilityIcon('tools', capabilities.tools)}
                  {renderCapabilityIcon('reasoning', capabilities.reasoning)}
                  {/* {isSystemAssistant(assistant) && (
                    <span className="system-badge">System</span>
                  )} */}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AssistantSelector;
