import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { getSelectableAssistants, getCurrentAssistantId } from '../../services/chatService';
import AssistantDropdown from './AssistantDropdown';
import './AssistantSelector.css';

interface AssistantSelectorProps {
  className?: string;
}

export default function AssistantSelector({ className }: AssistantSelectorProps) {
  useSignals();
  const { t } = useTranslation();
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


  return (
    <div className={`assistant-selector-container ${className || ''}`} ref={selectorRef}>
      <button 
        type="button"
        className="assistant-selector-button"
        onClick={toggleDropdown}
        title={t('welcome.selectAssistant')}
      >
        <div className="assistant-icon">
          <Icon name="assistants" size={1.75} className="icon" />
        </div>
        <span className="assistant-name">{selectedAssistant?.name || t('assistants.defaultAssistant')}</span>
        <Icon 
          name={isOpen ? "arrowDown" : "arrowUp"} 
          size={1.25} 
          className="expand-icon"
        />
      </button>

      <AssistantDropdown 
        isOpen={isOpen}
        direction="above"
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
}
