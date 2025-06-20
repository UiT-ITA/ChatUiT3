import React, { useEffect } from 'react';
import { useAssistants } from '../../hooks/useAssistants';
import { useCurrentAssistant } from '../../hooks/useChatData';
import AssistantSelector from './AssistantSelector';
import './NewChatWelcome.css';
import { useTranslation } from 'react-i18next';
import { chatStore } from '../../stores/ChatStore';

interface NewChatWelcomeProps {
  onSelectAssistant: (assistantId: string) => void;
}

const NewChatWelcome: React.FC<NewChatWelcomeProps> = ({ onSelectAssistant }) => {
  const { t } = useTranslation();
  const { assistantList, visibleAssistants, allAssistants } = useAssistants();
  const selectedAssistantId = useCurrentAssistant();
  
  
  let assistantsForSelector = [...visibleAssistants];
  if (selectedAssistantId) {
    const selectedAssistant = allAssistants.find(a => a.id === selectedAssistantId);
    if (selectedAssistant && !selectedAssistant.isVisible && !assistantsForSelector.find(a => a.id === selectedAssistantId)) {
      assistantsForSelector.push(selectedAssistant);
    }
  }

  
  useEffect(() => {
    if (!selectedAssistantId) {
      if (assistantList?.system?.[0]) {
        chatStore.setCurrentAssistantId(assistantList.system[0].id);
      } else if (assistantsForSelector.length > 0) {
        chatStore.setCurrentAssistantId(assistantsForSelector[0].id);
      }
    }
  }, [selectedAssistantId, assistantList, assistantsForSelector]);

  const handleSelectAssistant = (assistantId: string) => {
    chatStore.setCurrentAssistantId(assistantId);
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
            selectedAssistantId={selectedAssistantId || undefined}
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
