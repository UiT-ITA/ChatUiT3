import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../hooks/useChats';
import ChatMessage from './ChatMessage';
import ScrollToBottomButton from './ScrollToBottomButton';
import './ChatHistory.css';

const ChatHistory = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const { isAuthenticated, isInitializing } = useAuth();
  const { data: chat } = useChat(chatId || null, !isInitializing && isAuthenticated && !!chatId);
  const messages = chat?.messages || [];
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
    } else if (scrollDirection === 'down' && distanceFromBottom < 50) {
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

  return (
    <div className="chat-history" ref={chatHistoryRef}>
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onStreamingChunk={scrollToBottomIfShouldAutoScroll}
        />
      ))}
      
      <ScrollToBottomButton 
        chatContainerRef={chatHistoryRef}
        onScrollToBottom={handleScrollToBottomClick}
      />
    </div>
  );
};

export default React.memo(ChatHistory);
