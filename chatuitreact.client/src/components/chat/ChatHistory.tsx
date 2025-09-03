import './ChatHistory.css'
import { getChat, getCurrentChatId } from '../../services/chatService'
import { useSignals } from '@preact/signals-react/runtime';
import { useLayoutEffect, useRef, useState, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import ScrollToBottomButton from './ScrollToBottomButton';

export default function ChatHistory() {
  useSignals();
  
  const currentChatId = getCurrentChatId();
  const chatId = currentChatId.value;
  const chat = chatId ? getChat(chatId) : { value: undefined };
  const messages = chat.value?.messages || [];
  
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [prevScrollTop, setPrevScrollTop] = useState(0);

  const scrollToBottom = () => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  };

  const handleScroll = () => {
    if (!chatHistoryRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = chatHistoryRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const scrollDirection = scrollTop > prevScrollTop ? 'down' : 'up';
    
    if (scrollDirection === 'up' && distanceFromBottom > 0) {
      // Any upward scroll = disable auto-scroll immediately
      setShouldAutoScroll(false);
    } else if (scrollDirection === 'down' && distanceFromBottom < 100) {
      // Downward scroll near bottom = enable auto-scroll
      setShouldAutoScroll(true);
    }
    
    setPrevScrollTop(scrollTop);
  };

  const scrollToBottomIfShouldAutoScroll = () => {
    if (!chatHistoryRef.current) return;
    
    // Check scroll position in real-time to avoid race conditions
    const { scrollTop, scrollHeight, clientHeight } = chatHistoryRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isCurrentlyAtBottom = distanceFromBottom < 50; // Use original threshold during streaming
    
    if (isCurrentlyAtBottom) {
      scrollToBottom();
    }
  };

  const handleScrollToBottomClick = () => {
    scrollToBottom();
    setShouldAutoScroll(true);
  };

  // Attach scroll event listener
  useEffect(() => {
    const chatContainer = chatHistoryRef.current;
    if (!chatContainer) return;

    chatContainer.addEventListener('scroll', handleScroll);
    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, [shouldAutoScroll, prevScrollTop]);

  // Handle new messages - always scroll to bottom and enable auto-scroll
  useLayoutEffect(() => {
    setShouldAutoScroll(true);
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
        <div>Loading chat...</div>
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
      
      <ScrollToBottomButton 
        chatContainerRef={chatHistoryRef}
        onScrollToBottom={handleScrollToBottomClick}
      />
    </div>
  )
}
