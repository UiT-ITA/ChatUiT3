import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { Icon } from '../common/Icon';
import { getSelectableAssistants, getCurrentAssistantId } from '../../services/chatService';
import AssistantDropdown from '../common/AssistantDropdown';
import './NewChatWelcome.css';

export default function NewChatWelcome() {
  useSignals();
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
        <h1>Welcome to ChatUit</h1>
        <p>Start a conversation with your AI assistant.</p>
        
        <div className="assistant-section">
          <label>Choose your assistant:</label>
          <div className="assistant-dropdown-container" ref={dropdownRef}>
            <button 
              type="button"
              className="assistant-dropdown-button"
              onClick={toggleDropdown}
              title="Select AI assistant"
            >
              <span className="assistant-name">{selectedAssistant?.name || 'Assistant'}</span>
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
          <h3>Tips:</h3>
          <div className="tips-container">
            <div className="tip-card">
              <strong>Select the right assistant</strong>
              <p>Choose an assistant that fits your needs.</p>
            </div>
            <div className="tip-card">
              <strong>Upload files</strong>
              <p>Drag and drop files into the chat.</p>
            </div>
            <div className="tip-card">
              <strong>Ask clear questions</strong>
              <p>Be specific for better responses.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
