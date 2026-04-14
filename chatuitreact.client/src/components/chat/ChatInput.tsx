import './ChatInput.css';
import { useState, useRef } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { sendMessage, getCurrentChatId, getCurrentAssistantId, createChat } from '../../services/chatService';
import { FileProcessingService } from '../../services/fileProcessingService';
import { Icon } from '../common/Icon';
import AssistantSelector from '../common/AssistantSelector';
import FileThumbnail from './FileThumbnail';
import type { ProcessedFile } from '../../types/importModels';
import { SUPPORTED_IMPORT_ACCEPT, isValidFileType } from '../../utils/fileUtils';
import { useNavigate } from 'react-router-dom';
import { addNotification } from '../../services/notificationService';

export default function ChatInput() {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [selectedFiles, setSelectedFiles] = useState<ProcessedFile[]>([]);
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
        isValidFileType(file)
      );

      const conversionResults = await Promise.allSettled(
        fileArray.map(file => FileProcessingService.processFile(file))
      );

      const convertedFiles = conversionResults.flatMap((result) => {
        return result.status === 'fulfilled' ? [result.value] : [];
      });

      conversionResults.forEach((result, index) => {
        if (result.status !== 'rejected') {
          return;
        }

        const file = fileArray[index];
        if (!file) {
          return;
        }

          const reason = result.reason instanceof Error ? result.reason.message : 'File processing failed';
          console.error(`Failed to process file ${file.name}:`, result.reason);
          addNotification({
            level: 'Error',
            message: `${file.name}: ${reason}`
          });
      });

      setSelectedFiles(prev => [...prev, ...convertedFiles].slice(0, 10));
    }

    e.target.value = '';
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
              <FileThumbnail
                key={`${file.id}-${index}`}
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
              placeholder={t('chat.messagePlaceholder')}
              onKeyDown={handleKeyDown}
            />
          </div>
            <button
              type="submit"
              className="send-container"
              title={t('chat.sendMessage')}
            >
              <Icon name="send" size={1.75} className="icon" />
            </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            multiple
            accept={SUPPORTED_IMPORT_ACCEPT}
          />
        </form>
      </div>
    </div>
  );
}
