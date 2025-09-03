import './ChatInput.css';
import { useState, useRef } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { sendMessage, getCurrentChatId, getCurrentAssistantId, createChat } from '../../services/chatService';
import { FileProcessingService } from '../../services/fileProcessingService';
import { Icon } from '../common/Icon';
import AssistantSelector from '../common/AssistantSelector';
import FilePreview from './FilePreview';
import type { CreateChatFileDto } from '../../models/chatModels';
import { useNavigate } from 'react-router-dom';

export default function ChatInput() {
  useSignals();
  const navigate = useNavigate();

  const [selectedFiles, setSelectedFiles] = useState<CreateChatFileDto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentChatId = getCurrentChatId();
  const currentAssistantId = getCurrentAssistantId();
  const chatId = currentChatId.value;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const message = textareaRef.current?.value?.trim() || '';

    if (!message && selectedFiles.length === 0) {
      console.warn('No message or files to send');
      return;
    }

    try {
      if (chatId !== undefined) {
        await sendMessage(chatId, message, selectedFiles);
      } else {
        const newChatId = await createChat(message, currentAssistantId.value!, selectedFiles);

        if (!newChatId) {
          console.error('Failed to create new chat');
          return;
        }

        console.log('New chat created with ID:', newChatId);
        navigate('/chat/' + newChatId);
      }

      handleCleanup();
    } catch (error) {
      console.error('Failed to send message:', error);
    }

  };

  const handleCleanup = () => {
    if (textareaRef.current) {
      textareaRef.current.value = '';
    }
    setSelectedFiles([]);

    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArray = Array.from(files).filter(file =>
        FileProcessingService.isImageFile(file) || FileProcessingService.isTextFile(file)
      );

      const convertedFiles = await Promise.all(
        fileArray.map(file => FileProcessingService.processFile(file))
      );

      setSelectedFiles(prev => [...prev, ...convertedFiles].slice(0, 10));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="chat-input">
      <div className="outer-container">
        {selectedFiles.length > 0 && (
          <div className="input-file-previews">
            {selectedFiles.map((file, index) => (
              <FilePreview
                key={`${file.filename}-${index}`}
                file={file}
                onRemove={() => removeFile(index)}
                showRemoveButton={true}
              />
            ))}
          </div>
        )}

        <form className="inner-container" onSubmit={handleSendMessage}>
          <div className="tools-container">
            <div className="spacer-div"></div>
            <div className="tools-expand">
              <Icon name="more" size={1.75} className="icon" />
            </div>
            <button type="button" className="attach" onClick={handleFileUpload}>
              <Icon name="attach" size={1.75} className="icon" />
            </button>
            <div className="assistant-selector-wrapper">
              <AssistantSelector />
            </div>
          </div>

          <div className="input-container">
            <textarea
              ref={textareaRef}
              className="input-box"
              placeholder="Type a message..."
              onKeyDown={handleKeyDown}
            />
          </div>
            <button
              type="submit"
              className="send-container"
              title="Send message"
            >
              <Icon name="send" size={1.75} className="icon" />
            </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            multiple
            accept=".txt,.csv,.json,image/jpeg,image/png"
          />
        </form>
      </div>
    </div>
  );
}
