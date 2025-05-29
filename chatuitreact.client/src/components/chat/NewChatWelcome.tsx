import React, { useState } from 'react';
import { getAllAssistants } from '../../services/mockAssistantService';
import AssistantSelector from './AssistantSelector';
import './NewChatWelcome.css';
import { useTranslation } from 'react-i18next';

interface NewChatWelcomeProps {
  initialAssistantId?: string;
  onSelectAssistant: (assistantId: string) => void;
}

const NewChatWelcome: React.FC<NewChatWelcomeProps> = ({ 
  initialAssistantId, 
  onSelectAssistant 
}) => {
  const { t } = useTranslation();
  const assistants = getAllAssistants();
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | undefined>(initialAssistantId);

  const handleSelectAssistant = (assistantId: string) => {
    setSelectedAssistantId(assistantId);
    onSelectAssistant(assistantId);
  };

  return (
    <div className="new-chat-welcome">
      <div className="welcome-content">
        <h2>{t('welcome.header')}</h2>
        <p>{t('welcome.subheader')}</p>

        <div className="welcome-assistant-selector">
          <AssistantSelector 
            assistants={assistants}
            selectedAssistantId={selectedAssistantId}
            onSelectAssistant={handleSelectAssistant}
          />
        </div>
        
        <div className="welcome-features">
          <div className="feature-item">
            <h3>{t('welcome.files.title')}</h3>
            <p>{t('welcome.files.description')}</p>
          </div>
          <div className="feature-item">
            <h3>{t('welcome.tools.title')}</h3>
            <p>{t('welcome.tools.description')}</p>
          </div>
          <div className="feature-item">
            <h3>{t('welcome.reasoning.title')}</h3>
            <p>{t('welcome.reasoning.description')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewChatWelcome;
