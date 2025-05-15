import React, { useState } from 'react';
import { getAllAssistants } from '../../services/mockAssistantService';
import AssistantSelector from './AssistantSelector';
import './NewChatWelcome.css';

interface NewChatWelcomeProps {
  initialAssistantId?: string;
  onSelectAssistant: (assistantId: string) => void;
}

const NewChatWelcome: React.FC<NewChatWelcomeProps> = ({ 
  initialAssistantId, 
  onSelectAssistant 
}) => {
  const assistants = getAllAssistants();
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | undefined>(initialAssistantId);

  const handleSelectAssistant = (assistantId: string) => {
    setSelectedAssistantId(assistantId);
    onSelectAssistant(assistantId);
  };

  return (
    <div className="new-chat-welcome">
      <div className="welcome-content">
        <h2>Start a New Chat</h2>
        <p>Select an AI assistant to begin your conversation</p>
        
        <div className="welcome-assistant-selector">
          <AssistantSelector 
            assistants={assistants}
            selectedAssistantId={selectedAssistantId}
            onSelectAssistant={handleSelectAssistant}
          />
        </div>
        
        <div className="welcome-features">
          <div className="feature-item">
            <h3>Vision Support</h3>
            <p>Some assistants can analyze images and provide insights</p>
          </div>
          <div className="feature-item">
            <h3>Internet Access</h3>
            <p>Access to current information for real-time assistance</p>
          </div>
          <div className="feature-item">
            <h3>Advanced Reasoning</h3>
            <p>Complex problem-solving and logical reasoning abilities</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewChatWelcome;
