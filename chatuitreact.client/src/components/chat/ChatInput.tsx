import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import './ChatInput.css';
import { MdSend, MdKeyboardArrowDown, MdKeyboardArrowUp, MdSearch, MdCloud, MdTune, MdAttachFile  } from "react-icons/md";
import { useTranslation } from 'react-i18next';
import ToolbarTool from './ToolbarTool';
import AssistantSelector from './AssistantSelector';
import { getAllAssistants } from '../../services/mockAssistantService';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  initialAssistantId?: string;
}

const ChatInput = ({ onSendMessage, initialAssistantId }: ChatInputProps) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [activeTools, setActiveTools] = useState<{[key: string]: boolean}>({
    search: false,
    cloud: false
  });
  const [temperature, setTemperature] = useState<number>(0.7);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | undefined>(initialAssistantId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Load all available assistants
  const assistants = getAllAssistants();

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (message.trim()) {
      onSendMessage(message);
      console.log('Submitting files:', selectedFiles);
      setSelectedFiles([]);
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleToolbar = () => {
    setIsToolbarExpanded(!isToolbarExpanded);
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const toggleTool = (toolName: string) => {
    setActiveTools(prev => {
      const newState = { ...prev, [toolName]: !prev[toolName] };
      console.log('Tool state changed:', newState);
      return newState;
    });
  };

  const handleTemperatureChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setTemperature(value);
    console.log('Temperature changed:', value);
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files)
        .filter(file =>
          ['text/plain','text/csv','application/json','image/jpeg','image/png'].includes(file.type)
        );
      fileArray.forEach(file => {
        console.log('File:', file.name, file.size);
      });
      setSelectedFiles(prev => {
        const combined = [...prev, ...fileArray].slice(0, 10);
        return combined;
      });
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
  };

  return (
    <div className="chat-input-outer-container">
    <div className={`chat-input-inner-container ${isToolbarExpanded ? 'toolbar-expanded' : ''}`}>
      {selectedFiles.length > 0 && (
        <div className="file-thumbnails">
          {selectedFiles.map((file, index) => (
            <div key={index} className={`thumbnail ${file.type.startsWith('image/') ? 'image' : 'text'}`}>
              {file.type.startsWith('image/') ? (
                <img src={URL.createObjectURL(file)} alt={file.name} />
              ) : (
                <div className="file-icon">
                  <div className="file-name">{file.name}</div>
                  <div className="file-type">
                    {file.name.split('.').pop()?.toUpperCase()} file
                  </div>
                </div>
              )}
              <button type="button" className="remove-btn" onClick={() => removeFile(index)}>×</button>
            </div>
          ))}
        </div>
      )}
        <form className="chat-input" onSubmit={handleSubmit}>
          {!isToolbarExpanded && (
            <button 
              type="button"
              className="chat-input-button toggle-toolbar-button" 
              onClick={toggleToolbar}
              title="Expand toolbar"
            >
              <MdKeyboardArrowDown size={"24px"} />
            </button>
          )}

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.messagePlaceholder')}
            rows={1}
            className={isToolbarExpanded ? 'full-width' : ''}
          />

          {!isToolbarExpanded && (
            <button 
              type="submit"
              className="chat-input-button" 
              disabled={!message.trim()}
              title={t('chat.sendMessage')}
            >
              <MdSend size={"24px"} />
            </button>
          )}
        </form>
        
        {isToolbarExpanded && (
          <div className="chat-input-toolbar">
            <button 
              type="button"
              className="chat-input-button toggle-toolbar-button" 
              onClick={toggleToolbar}
              title="Collapse toolbar"
            >
              <MdKeyboardArrowUp size={"24px"} />
            </button>
            
            <AssistantSelector 
              assistants={assistants}
              selectedAssistantId={selectedAssistantId}
              onSelectAssistant={setSelectedAssistantId}
            />
            
            <ToolbarTool 
              icon={<MdAttachFile size={"20px"} />} 
              label="Upload File" 
              onClick={handleFileUpload}
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              multiple
              accept=".txt,.csv,.json,image/jpeg,image/png"
            />
            <div className="toolbar-tools">
              <ToolbarTool 
                icon={<MdSearch size={"20px"} />} 
                label="Search" 
                isToggleable={true}
                isActive={activeTools.search}
                onClick={() => toggleTool('search')}
              />
              <ToolbarTool 
                icon={<MdCloud size={"20px"} />} 
                label="Save to Cloud" 
                isToggleable={true}
                isActive={activeTools.cloud}
                onClick={() => toggleTool('cloud')}
              />
              <ToolbarTool 
                icon={<MdTune size={"20px"} />} 
                label="Temperature" 
                onClick={() => {}}
                hideLabel={true}
              >
                <div className="temperature-slider-container">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={handleTemperatureChange}
                    className="temperature-slider"
                  />
                  <span className="temperature-value">{temperature.toFixed(1)}</span>
                </div>
              </ToolbarTool>
            </div>
            
            <button 
              className="chat-input-button send-button-toolbar" 
              disabled={!message.trim()}
              onClick={handleSubmit}
              title={t('sendMessage')}
            >
              <MdSend size={"24px"} />
            </button>
          </div>
        )}
      </div>
      {/* <div className="chat-input-footer">
        ChatGPT can make mistakes. Consider checking important information.
      </div> */}
    </div>
  );
};

export default ChatInput;
