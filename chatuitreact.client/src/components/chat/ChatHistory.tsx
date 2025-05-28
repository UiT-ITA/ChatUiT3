import React from 'react';
import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import './ChatHistory.css';
import { useActiveChatMessages } from '../../hooks/useChatData';

const ChatHistory = () => {
  const messages = useActiveChatMessages();
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
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
