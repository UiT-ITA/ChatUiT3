import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { sendMessage, sendNewChatMessage, deleteChat, getCurrentChatId, getCurrentAssistantId, getChat, cancelGeneration, forgetChat } from '../../services/chatService';
import { removeCachedChat } from '../../hooks/useChatCache';
import { FileProcessingService } from '../../services/fileProcessingService';
import AssistantSelector from './AssistantSelector';
import { parseRoute } from '../../utils/routes';
import ChatClassification from './ChatClassification';
import Popover, { PopoverBody, PopoverGroup } from '../common/Popover';
import IconButton from '../common/IconButton';
import ProgressRing from '../common/ProgressRing';
import Box from '../common/Box';
import Stack from '../common/Stack';
import Text from '../common/Text';
import ContextUsageDetails from './ContextUsageDetails';
import FileThumbnail from './FileThumbnail';
import type { ChatFile } from '../../types/fileModels';
import { SUPPORTED_IMPORT_ACCEPT, isValidFileType } from '../../utils/fileUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import { addNotification } from '../../services/notificationService';
import { getContextUsage, setDraft } from '../../services/contextUsageService';
import { formatTokens, formatTokensCompact } from '../../utils/tokenCounting';
import TextArea from '../common/TextArea';
import InteractionCard from './interaction/InteractionCard';
import { useInteractionDock } from '../../hooks/useInteractionDock';
import './Composer.css';

const DRAFT_COUNT_DEBOUNCE_MS = 150;
const DISCLAIMER_KEY = 'chatuit-disclaimer-dismissed';

export default function ChatInput() {
  useSignals();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedFiles, setSelectedFiles] = useState<ChatFile[]>([]);
  const [charCount, setCharCount] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  // The disclaimer stays dismissed in this browser. Shown when the storage cannot be read.
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISCLAIMER_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // What was last sent per chat, put back in the composer when its generation is cancelled
  const lastSentRef = useRef(new Map<string, { text: string; files: ChatFile[] }>());

  const currentAssistantId = getCurrentAssistantId();
  const chatId = getCurrentChatId().value;

  // The assistant message the server marked Generating
  const chat = chatId !== undefined ? getChat(chatId).value : undefined;
  const generatingMessage = chat?.messages.find(m => m.role === 'Assistant' && m.status === 'Generating');
  const isGenerating = generatingMessage !== undefined;
  const dock = useInteractionDock(chatId);

  const usage = getContextUsage(chatId).value;
  const contextFraction = usage.contextSize > 0 ? usage.total / usage.contextSize : 0;


  // Recounts the draft at once when the attachments change. Typing is counted after a debounce.
  useEffect(() => {
    clearTimeout(draftDebounceRef.current);
    setDraft(textareaRef.current?.value ?? '', selectedFiles);
  }, [selectedFiles]);

  // Focuses the message box on every path change
  useEffect(() => {
    textareaRef.current?.focus();
  }, [location.pathname]);

  const dismissDisclaimer = () => {
    setDisclaimerDismissed(true);
    try {
      localStorage.setItem(DISCLAIMER_KEY, 'true');
    } catch {
      // Stays dismissed until the page reloads
    }
  };

  const fillComposer = (text: string, files: ChatFile[]) => {
    if (textareaRef.current) textareaRef.current.value = text;
    setCharCount(text.length);
    setSelectedFiles(files);
    clearTimeout(draftDebounceRef.current);
    setDraft(text, files);
    textareaRef.current?.focus();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    // Sends nothing while a response is generating or the chat is loading
    if (isGenerating || (chatId !== undefined && chat === undefined)) return;

    const message = textareaRef.current?.value?.trim() || '';
    if (!message && selectedFiles.length === 0) return;

    const sentFiles = selectedFiles;
    fillComposer('', []);

    let newChatId: string | undefined;
    try {
      if (chatId !== undefined) {
        lastSentRef.current.set(chatId, { text: message, files: sentFiles });
        await sendMessage(chatId, message, sentFiles, dock.pendingAnswers());
      } else {
        await sendNewChatMessage(message, sentFiles, currentAssistantId.value!, (createdChatId) => {
          newChatId = createdChatId;
          lastSentRef.current.set(createdChatId, { text: message, files: sentFiles });
          // Opens the new chat while a new chat path is still shown: /, /chat and /chat/new
          const route = parseRoute(window.location.pathname);
          if (route.section === 'chats' && route.chatId === undefined) navigate('/chat/' + createdChatId);
        });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      if (chatId === undefined) {
        navigate('/');
        if (newChatId !== undefined) {
          removeCachedChat(newChatId);
          deleteChat(newChatId).catch(() => {});
        }
      }
      fillComposer(message, sentFiles);
    }
  };

  const handleCancel = async () => {
    if (chatId === undefined || !generatingMessage || isCancelling) return;
    setIsCancelling(true);
    try {
      const { cancelled, undone } = await cancelGeneration(chatId, generatingMessage.id);
      // Leaves the composer as it is when the generation finished first, or when the message keeps what it had
      if (!cancelled || !undone) return;

      // Both messages are deleted: puts back the sent text and attachments, or without a snapshot the text of the last user message
      const snapshot = lastSentRef.current.get(chatId);
      const cancelledUserMessage = [...(chat?.messages ?? [])].reverse().find(m => m.role === 'User');
      fillComposer(snapshot?.text ?? cancelledUserMessage?.content ?? '', snapshot?.files ?? []);
      lastSentRef.current.delete(chatId);

      // Leaves and forgets a chat that has no messages left
      if ((chat?.messages ?? []).every(m => m.id === generatingMessage.id || m.id === cancelledUserMessage?.id)) {
        navigate('/');
        forgetChat(chatId);
      }
    } catch (error) {
      console.error('Failed to cancel generation:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  const addFiles = async (files: File[]) => {
    const valid = files.filter(file => isValidFileType(file));
    files.filter(file => !isValidFileType(file)).forEach(file => addNotification({
      level: 'Warning',
      message: `${file.name}: ${t('files.typeNotSupported')}`
    }));
    if (valid.length === 0) return;

    const results = await Promise.allSettled(valid.map(file => FileProcessingService.processFile(file)));
    results.forEach((result, index) => {
      if (result.status !== 'rejected') return;
      const reason = result.reason instanceof Error ? result.reason.message : 'File processing failed';
      console.error(`Failed to process file ${valid[index].name}:`, result.reason);
      addNotification({ level: 'Error', message: `${valid[index].name}: ${reason}` });
    });
    setSelectedFiles(prev => [...prev, ...results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])].slice(0, 10));
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    setIsDragOver(false);
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    void addFiles(Array.from(e.dataTransfer.files));
    textareaRef.current?.focus();
  };

  return (
    <div className="composer-dock">
      <div className="composer">
        <form
          className="composer-card"
          data-drop-active={isDragOver || undefined}
          onSubmit={handleSendMessage}
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={e => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDragOver(false);
          }}
          onDrop={handleDrop}
        >
          <InteractionCard dock={dock} />

          {selectedFiles.length > 0 && (
            <Stack direction="row" wrap gap="sm" pt="md" px="md">
              {selectedFiles.map((file, index) => (
                <FileThumbnail
                  key={`${file.id}-${index}`}
                  file={file}
                  onRemove={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                />
              ))}
            </Stack>
          )}

          <TextArea
            ref={textareaRef}
            variant="unstyled"
            size="large"
            autoResize
            minRows={1}
            maxRows={6}
            placeholder={t('chat.messagePlaceholder')}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            onPaste={e => {
              const files = Array.from(e.clipboardData.files);
              if (files.length === 0) return;
              e.preventDefault();
              void addFiles(files);
            }}
            onChange={(value) => {
              setCharCount(value.length);
              clearTimeout(draftDebounceRef.current);
              draftDebounceRef.current = setTimeout(() => setDraft(value, selectedFiles), DRAFT_COUNT_DEBOUNCE_MS);
            }}
          />

          {/* The toolbar's popovers open one at a time */}
          <div className="composer-toolbar">
            <PopoverGroup>
              <IconButton icon="attach" label={t('chat.attachFile')} variant="subtle" size="small" onClick={() => fileInputRef.current?.click()} />
              <AssistantSelector />
              <ChatClassification />
              <Box grow />
              {usage.available ? (
                <Popover
                  openOn="hover"
                  placement="top-end"
                  panelWidth="large"
                  className="composer-toolbar__popover"
                  trigger={(
                    <IconButton
                      icon={<ProgressRing fraction={contextFraction} state={usage.level} />}
                      label={t('chat.contextHint', {
                        used: formatTokens(usage.total, i18n.language),
                        limit: formatTokensCompact(usage.contextSize, i18n.language),
                      })}
                      size="small"
                      tooltip={false}
                    />
                  )}
                  title={t('chat.panel.context')}
                >
                  <PopoverBody>
                    <ContextUsageDetails usage={usage} />
                  </PopoverBody>
                </Popover>
              ) : charCount > 0 && (
                <Text as="div" variant="hint" tone="muted" wrap="nowrap" mr="sm">{t('chat.charCount', { count: charCount })}</Text>
              )}
              {isGenerating ? (
                <IconButton
                  icon="stop"
                  label={t('chat.cancelGeneration')}
                  variant="primary"
                  size="small"
                  onClick={handleCancel}
                  disabled={isCancelling || generatingMessage?.optimistic}
                />
              ) : (
                <IconButton
                  type="submit"
                  icon="send"
                  label={t('chat.sendMessage')}
                  variant={charCount === 0 && selectedFiles.length === 0 ? 'outline' : 'primary'}
                  size="small"
                />
              )}
            </PopoverGroup>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={async e => {
              await addFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
            hidden
            multiple
            accept={SUPPORTED_IMPORT_ACCEPT}
          />
        </form>
        {!disclaimerDismissed && (
          <div className="composer-disclaimer t-hint">
            <span>{t('chat.disclaimer')}</span>
            <IconButton className="composer-disclaimer__dismiss" icon="close" label={t('common.close')} size="xs" onClick={dismissDisclaimer} />
          </div>
        )}
      </div>
    </div>
  );
}
