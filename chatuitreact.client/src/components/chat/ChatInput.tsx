import './ChatInput.css';
import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { sendMessage, getCurrentChatId, getCurrentAssistantId, createChat } from '../../services/chatService';
import { FileProcessingService } from '../../services/fileProcessingService';
import { Icon } from '../common/Icon';
import AssistantSelector from '../common/AssistantSelector';
import FileThumbnail from './FileThumbnail';
import type { ChatFile } from '../../types/fileModels';
import { SUPPORTED_IMPORT_ACCEPT, isValidFileType } from '../../utils/fileUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import { addNotification } from '../../services/notificationService';

export default function ChatInput() {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedFiles, setSelectedFiles] = useState<ChatFile[]>([]);
  const [charCount, setCharCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentChatId = getCurrentChatId();
  const currentAssistantId = getCurrentAssistantId();
  const chatId = currentChatId.value;

  // Keyed on the path, not the chat id: the composer never unmounts, and coming
  // back from /admin or /settings to a new chat leaves the chat id undefined both
  // before and after — so a chat-id dep would never fire.
  useEffect(() => {
    textareaRef.current?.focus();
  }, [location.pathname]);

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
    setCharCount(0);

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
      <div className="composer">
        <form className="composer-card" onSubmit={handleSendMessage}>
          {selectedFiles.length > 0 && (
            <div className="composer-file-previews">
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

          <textarea
            ref={textareaRef}
            className="composer-textarea t-body-lg"
            rows={2}
            placeholder={t('chat.messagePlaceholder')}
            onKeyDown={handleKeyDown}
            onChange={(e) => setCharCount(e.target.value.length)}
          />

          <div className="composer-toolbar">
            <button
              type="button"
              className="composer-tool-button"
              onClick={handleFileUpload}
              title={t('chat.attachFile')}
            >
              <Icon name="attach" size={1.0625} className="icon" />
            </button>
            <AssistantSelector className="composer-assistant" />
            <div className="composer-spacer" />
            {charCount > 0 && (
              <div className="composer-char-count t-meta">{t('chat.charCount', { count: charCount })}</div>
            )}
            <button
              type="submit"
              className="composer-send t-ui"
              title={t('chat.sendMessage')}
            >
              <Icon name="send" size={0.9375} className="icon" />
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            multiple
            accept={SUPPORTED_IMPORT_ACCEPT}
          />
        </form>

        <div className="composer-hints t-hint">
          <span className="composer-hint-keys">{t('chat.enterHint')}</span>
          <span>{t('chat.disclaimer')}</span>
        </div>
      </div>
    </div>
  );
}
