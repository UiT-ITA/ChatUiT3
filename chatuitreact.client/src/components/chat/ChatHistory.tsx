import React from 'react';
import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import './ChatHistory.css';
import { useActiveChatMessages } from '../../hooks/useChatData';
import { ChatStatus } from '../../types/chatModels';

const ChatHistory = () => {
  const messages = useActiveChatMessages();
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  };

const scrollToBottomIfNeeded = () => {
  if (!chatHistoryRef.current) return;
  
  const lastMessage = chatHistoryRef.current.lastElementChild as HTMLElement;
  if (!lastMessage) return;
  
  const containerRect = chatHistoryRef.current.getBoundingClientRect();
  const messageRect = lastMessage.getBoundingClientRect();
  
  // Check if the top of the last message is visible
  const isTopVisible = messageRect.top >= containerRect.top && messageRect.top <= containerRect.bottom;

  // Check if ANY part of the last message is visible in the viewport
  const isAnyPartVisible = messageRect.bottom > containerRect.top && messageRect.top < containerRect.bottom;
  
  // Only scroll if the last message is NOT visible (user scrolled up)
  if (!isAnyPartVisible || isTopVisible) {
    scrollToBottom();
  }
};

useEffect(() => {
  const lastMessage = messages[messages.length - 1];
  
  // Case 1: New generating message - ALWAYS scroll
  if (lastMessage?.status === ChatStatus.Generating) {
    scrollToBottom();
  } else {
    // Case 2: Other times - only scroll if user not viewing last message
    scrollToBottomIfNeeded();
  }
}, [messages]);

  return (
    <div className="chat-history" ref={chatHistoryRef}>
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </div>
  );
};

export default React.memo(ChatHistory);
