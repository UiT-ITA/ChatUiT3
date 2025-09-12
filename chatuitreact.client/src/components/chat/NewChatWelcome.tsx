import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Icon';
import { getSelectableAssistants, getCurrentAssistantId } from '../../services/chatService';
import AssistantDropdown from '../common/AssistantDropdown';
import './NewChatWelcome.css';

export default function NewChatWelcome() {
  useSignals();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectableAssistants = getSelectableAssistants().value || [];
  const currentAssistantId = getCurrentAssistantId().value;
  const selectedAssistant = selectableAssistants.find(a => a.id === currentAssistantId) || selectableAssistants[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
    <div className="new-chat-welcome">
      <div className="welcome-container">
        <h1>{t('welcome.header')}</h1>
        <p>{t('welcome.subheader')}</p>
        
        <div className="assistant-section">
          <label>{t('welcome.chooseAssistant')}</label>
          <div className="assistant-dropdown-container" ref={dropdownRef}>
            <button 
              type="button"
              className="assistant-dropdown-button"
              onClick={toggleDropdown}
              title={t('welcome.selectAssistant')}
            >
              <span className="assistant-name">{selectedAssistant?.name || t('assistants.defaultAssistant')}</span>
              <Icon 
                name={isOpen ? "arrowUp" : "arrowDown"} 
                size={1.25} 
                className="expand-icon"
              />
            </button>
            <AssistantDropdown 
              isOpen={isOpen}
              direction="below"
              onClose={() => setIsOpen(false)}
            />
          </div>
        </div>

        <div className="tips-section">
          <h3>{t('welcome.tips.title')}</h3>
          <div className="tips-container">
            <div className="tip-card">
              <strong>{t('welcome.tips.selectAssistant.title')}</strong>
              <p>{t('welcome.tips.selectAssistant.description')}</p>
            </div>
            <div className="tip-card">
              <strong>{t('welcome.tips.uploadFiles.title')}</strong>
              <p>{t('welcome.tips.uploadFiles.description')}</p>
            </div>
            <div className="tip-card">
              <strong>{t('welcome.tips.askQuestions.title')}</strong>
              <p>{t('welcome.tips.askQuestions.description')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
