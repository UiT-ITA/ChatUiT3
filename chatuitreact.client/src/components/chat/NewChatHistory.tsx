import './ChatHistory.css';
import { getChat } from '../../services/chatService';
import { useSignals } from '@preact/signals-react/runtime';
import { memo, useLayoutEffect, useRef, useEffect, useCallback, useDeferredValue } from 'react';
import { useTranslation } from 'react-i18next';
import ChatMessage from './ChatMessage';
import LoadingIndicator from '../common/LoadingIndicator';

interface NewChatHistoryProps {
  chatId: string;
  isActive?: boolean;
}

function NewChatHistory({ chatId, isActive = true }: NewChatHistoryProps) {
  useSignals();
  const { t } = useTranslation();

  const chat = getChat(chatId);
  const messages = chat.value?.messages || [];

  const deferredMessages = useDeferredValue(messages);
  const effectiveMessages = isActive ? deferredMessages : messages;
  const isPending = isActive && deferredMessages !== messages;

  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const prevScrollTopRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  };

  const evaluateAutoScroll = () => {
    if (!chatHistoryRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatHistoryRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const scrollDirection = scrollTop > prevScrollTopRef.current ? 'down' : 'up';

    if (scrollDirection === 'up' && distanceFromBottom > 0) {
      autoScrollRef.current = false;
    } else if (scrollDirection === 'down' && distanceFromBottom < 100) {
      autoScrollRef.current = true;
    }

    prevScrollTopRef.current = scrollTop;
  };

  const handleScroll = () => {
    if (rafIdRef.current != null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      evaluateAutoScroll();
    });
  };

  const scrollToBottomIfShouldAutoScroll = useCallback(() => {
    if (!chatHistoryRef.current || !autoScrollRef.current || !isActive) return;
    requestAnimationFrame(() => {
      if (chatHistoryRef.current && autoScrollRef.current) {
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
      }
    });
  }, [isActive]);

  // Attach scroll listener only when active to avoid unnecessary handlers on hidden views
  useEffect(() => {
    if (!isActive) return;
    const chatContainer = chatHistoryRef.current;
    if (!chatContainer) return;

    chatContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, [isActive]);

  // Handle new messages - always scroll to bottom when active and auto-scroll enabled
  useLayoutEffect(() => {
    if (isActive && autoScrollRef.current) {
      scrollToBottom();
    }
  }, [messages, isActive]);

  // Ensure scroll after deferred render when active
  useLayoutEffect(() => {
    if (isActive) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [deferredMessages, isActive]);

  if (chat.value === undefined || isPending) {
    return (
      <div className="chat-history" ref={chatHistoryRef}>
        <div className="chat-history-loading">
          <LoadingIndicator text={t('chat.loadingChat')} />
        </div>
      </div>
    );
  }

  return (
    <div className="chat-history" ref={chatHistoryRef}>
      <div className="chat-history-messages">
        {effectiveMessages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onStreamingChunk={scrollToBottomIfShouldAutoScroll}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(NewChatHistory, (prev, next) =>
  prev.chatId === next.chatId && prev.isActive === next.isActive
);
