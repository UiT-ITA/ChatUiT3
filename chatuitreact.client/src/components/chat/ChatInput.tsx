import './ChatInput.css';
import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { sendMessage, getCurrentChatId, getCurrentAssistantId, createChat, getChat, cancelGeneration, forgetChat, getActivitySignal } from '../../services/chatService';
import { FileProcessingService } from '../../services/fileProcessingService';
import { Icon } from '../common/Icon';
import AssistantSelector from '../common/AssistantSelector';
import FileThumbnail from './FileThumbnail';
import type { ChatFile } from '../../types/fileModels';
import { SUPPORTED_IMPORT_ACCEPT, isValidFileType } from '../../utils/fileUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import { addNotification } from '../../services/notificationService';
import { getContextUsage, setDraft } from '../../services/contextUsageService';
import { formatTokens, formatTokensCompact } from '../../utils/tokenCounting';

const DRAFT_COUNT_DEBOUNCE_MS = 150;

export default function ChatInput() {
  useSignals();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedFiles, setSelectedFiles] = useState<ChatFile[]>([]);
  const [charCount, setCharCount] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // What was last sent per chat, so a cancel can put it straight back in the composer.
  // A ref, not state: the composer never unmounts, and this must not trigger renders.
  const lastSentRef = useRef(new Map<string, { text: string; files: ChatFile[] }>());

  const currentChatId = getCurrentChatId();
  const currentAssistantId = getCurrentAssistantId();
  const chatId = currentChatId.value;

  // Same source of truth ChatMessage uses: the assistant message the server marked Generating.
  const chatSignal = chatId !== undefined ? getChat(chatId) : undefined;
  const chat = chatSignal?.value;
  const generatingMessage = chat?.messages.find(
    m => m.role === 'Assistant' && m.status === 'Generating'
  );
  const isGenerating = generatingMessage !== undefined;
  const awaitingUser = generatingMessage !== undefined && getActivitySignal(generatingMessage.id).value.phase === 'awaitingUser';

  const usage = getContextUsage(chatId).value;

  // Attachments change rarely and cost the most, so they recount at once; typing is debounced.
  useEffect(() => {
    clearTimeout(draftDebounceRef.current);
    setDraft(textareaRef.current?.value ?? '', selectedFiles);
  }, [selectedFiles]);

  const scheduleDraftCount = (text: string) => {
    clearTimeout(draftDebounceRef.current);
    draftDebounceRef.current = setTimeout(() => setDraft(text, selectedFiles), DRAFT_COUNT_DEBOUNCE_MS);
  };

  // Keyed on the path, not the chat id: the composer never unmounts, and coming
  // back from /admin or /settings to a new chat leaves the chat id undefined both
  // before and after — so a chat-id dep would never fire.
  useEffect(() => {
    textareaRef.current?.focus();
  }, [location.pathname]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    // While a response is generating the composer shows Cancel, but Enter still submits.
    if (isGenerating) {
      return;
    }

    const message = textareaRef.current?.value?.trim() || '';

    if (!message && selectedFiles.length === 0) {
      console.warn('No message or files to send');
      return;
    }

    const sentFiles = selectedFiles;

    try {
      if (chatId !== undefined) {
        await sendMessage(chatId, message, sentFiles);
        lastSentRef.current.set(chatId, { text: message, files: sentFiles });
      } else {
        const newChatId = await createChat(message, currentAssistantId.value!, sentFiles);

        if (!newChatId) {
          console.error('Failed to create new chat');
          return;
        }
        lastSentRef.current.set(newChatId, { text: message, files: sentFiles });
        navigate('/chat/' + newChatId);
      }

      handleCleanup();
    } catch (error) {
      console.error('Failed to send message:', error);
    }

  };

  const handleCancel = async () => {
    if (chatId === undefined || !generatingMessage || isCancelling) {
      return;
    }

    setIsCancelling(true);

    try {
      const cancelled = await cancelGeneration(chatId, generatingMessage.id);

      // Already finished before the click landed — the answer stands, leave the composer alone.
      if (!cancelled) {
        return;
      }

      // The server deleted both messages, so put the send back exactly as it was.
      // Without a snapshot (a page reload since sending) the text is still recoverable
      // from the chat itself; the attachments are not.
      const snapshot = lastSentRef.current.get(chatId);
      const cancelledUserMessage = [...(chat?.messages ?? [])]
        .reverse()
        .find(m => m.role === 'User');
      const text = snapshot?.text ?? cancelledUserMessage?.content ?? '';

      if (textareaRef.current) {
        textareaRef.current.value = text;
      }
      setCharCount(text.length);
      setSelectedFiles(snapshot?.files ?? []);
      setDraft(text, snapshot?.files ?? []);
      lastSentRef.current.delete(chatId);

      // The server drops a chat left with no messages, so leave it behind here too.
      const survivingMessages = (chat?.messages ?? []).filter(
        m => m.id !== generatingMessage.id && m.id !== cancelledUserMessage?.id
      );
      if (survivingMessages.length === 0) {
        navigate('/');
        forgetChat(chatId);
      }

      textareaRef.current?.focus();
    } catch (error) {
      console.error('Failed to cancel generation:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleCleanup = () => {
    if (textareaRef.current) {
      textareaRef.current.value = '';
    }
    setSelectedFiles([]);
    setCharCount(0);
    clearTimeout(draftDebounceRef.current);
    setDraft('', []);

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

  const addFiles = async (files: File[]) => {
    const fileArray = files.filter(file => isValidFileType(file));

    files
      .filter(file => !isValidFileType(file))
      .forEach(file => addNotification({
        level: 'Warning',
        message: `${file.name}: ${t('files.typeNotSupported')}`
      }));

    if (fileArray.length === 0) {
      return;
    }

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
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await addFiles(Array.from(e.target.files ?? []));
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0) {
      return;
    }
    e.preventDefault();
    void addFiles(files);
  };

  const hasDraggedFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');

  const handleDragOver = (e: React.DragEvent) => {
    if (!hasDraggedFiles(e)) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
      return;
    }
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    setIsDragOver(false);
    if (!hasDraggedFiles(e)) {
      return;
    }
    e.preventDefault();
    void addFiles(Array.from(e.dataTransfer.files));
    textareaRef.current?.focus();
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="chat-input">
      <div className="composer">
        <form
          className="composer-card"
          onSubmit={handleSendMessage}
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-drop-active={isDragOver || undefined}
        >
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
            onPaste={handlePaste}
            onChange={(e) => {
              setCharCount(e.target.value.length);
              scheduleDraftCount(e.target.value);
            }}
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
            {usage.available ? (
              <div
                className="composer-token-count t-meta"
                data-state={usage.level}
                title={usage.isEstimate ? t('chat.contextEstimate') : undefined}
              >
                {usage.isEstimate && '≈ '}
                {t('chat.tokenCount', { count: usage.draft })}
                {' · '}
                {t('chat.contextHint', {
                  used: formatTokens(usage.total, i18n.language),
                  limit: formatTokensCompact(usage.contextSize, i18n.language),
                })}
              </div>
            ) : charCount > 0 && (
              <div className="composer-char-count t-meta">{t('chat.charCount', { count: charCount })}</div>
            )}
            {isGenerating ? (
              <button
                type="button"
                className="composer-send composer-cancel t-ui"
                onClick={handleCancel}
                disabled={isCancelling}
                title={t('chat.cancelGeneration')}
              >
                <Icon name="stop" size={0.9375} className="icon" />
              </button>
            ) : (
              <button
                type="submit"
                className="composer-send t-ui"
                title={t('chat.sendMessage')}
              >
                <Icon name="send" size={0.9375} className="icon" />
              </button>
            )}
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
          {awaitingUser
            ? <span className="composer-awaiting-hint">{t('chat.awaitingInputHint')}</span>
            : <span>{t('chat.disclaimer')}</span>}
        </div>
      </div>
    </div>
  );
}
