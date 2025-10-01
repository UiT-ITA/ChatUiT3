import './ChatHistory.css'
import { getChat, getCurrentChatId } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime';
import { useLayoutEffect, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ChatMessage from './ChatMessage';
import LoadingIndicator from '../common/LoadingIndicator';

export default function ChatHistory() {
  useSignals();
  const { t } = useTranslation();
  
  const currentChatId = getCurrentChatId();
  const chatId = currentChatId.value;
  const chat = chatId ? getChat(chatId) : { value: undefined };
  const messages = chat.value?.messages || [];
  
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
    if (!chatHistoryRef.current || !autoScrollRef.current) return;
    requestAnimationFrame(() => {
      if (chatHistoryRef.current && autoScrollRef.current) {
        chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
      }
    });
  }, []);


  // Attach scroll event listener
  useEffect(() => {
    const chatContainer = chatHistoryRef.current;
    if (!chatContainer) return;

    chatContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle new messages - always scroll to bottom and enable auto-scroll
  useLayoutEffect(() => {
    autoScrollRef.current = true;
    scrollToBottom();
  }, [messages]);

  if (!chatId) {
    return (
      <div className="chat-history">
        <div>Please select a chat to view its history.</div>
      </div>
    );
  }

  if (chat.value === undefined) {
    return (
      <div className="chat-history">
        <div className="chat-history-loading">
          <LoadingIndicator text={t('chat.loadingChat')} />
        </div>
      </div>
    );
  }

  return (
    <div className="chat-history" ref={chatHistoryRef}>
      <div className="chat-history-messages">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onStreamingChunk={scrollToBottomIfShouldAutoScroll}
          />
        ))}
      </div>
      
    </div>
  )
}
