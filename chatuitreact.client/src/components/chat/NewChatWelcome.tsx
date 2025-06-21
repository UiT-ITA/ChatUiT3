import React, { useEffect } from 'react';
import { useAssistants } from '../../hooks/useAssistants';
import { useCurrentAssistant } from '../../contexts/ChatDataProvider';
import AssistantSelector from './AssistantSelector';
import './NewChatWelcome.css';
import { useTranslation } from 'react-i18next';

interface NewChatWelcomeProps {
  onSelectAssistant: (assistantId: string) => void;
}

const NewChatWelcome: React.FC<NewChatWelcomeProps> = ({ onSelectAssistant }) => {
  const { t } = useTranslation();
  const { assistantList, visibleAssistants, allAssistants } = useAssistants();
  const { currentAssistantId, setCurrentAssistantId } = useCurrentAssistant();
  
  
  let assistantsForSelector = [...visibleAssistants];
  if (currentAssistantId) {
    const selectedAssistant = allAssistants.find(a => a.id === currentAssistantId);
    if (selectedAssistant && !selectedAssistant.isVisible && !assistantsForSelector.find(a => a.id === currentAssistantId)) {
      assistantsForSelector.push(selectedAssistant);
    }
  }

  
  useEffect(() => {
    if (!currentAssistantId) {
      if (assistantList?.system?.[0]) {
        setCurrentAssistantId(assistantList.system[0].id);
      } else if (assistantsForSelector.length > 0) {
        setCurrentAssistantId(assistantsForSelector[0].id);
      }
    }
  }, [currentAssistantId, assistantList, assistantsForSelector, setCurrentAssistantId]);

  const handleSelectAssistant = (assistantId: string) => {
    setCurrentAssistantId(assistantId);
    onSelectAssistant(assistantId);
  };

  return (
    <div className="new-chat-welcome">
      <div className="welcome-content">
        <h2>{t('welcome.header')}</h2>
        <p>{t('welcome.subheader')}</p>

        <div className="welcome-assistant-selector">
          <AssistantSelector 
            assistants={assistantsForSelector}
            selectedAssistantId={currentAssistantId || undefined}
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
