import React from 'react';
import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import './ChatHistory.css';
import { useActiveChatMessages } from '../../hooks/useChatData';
import { chatStore } from '../../stores/ChatStore';

const ChatHistory = () => {
  const messages = useActiveChatMessages();
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  };

  // Scroll when messages array changes (new messages)
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Scroll during streaming (when individual message content updates)
  useEffect(() => {
    const unsubscribe = chatStore.subscribe(() => {
      scrollToBottom();
    });
    return unsubscribe;
  }, []);

  return (
    <div className="chat-history" ref={chatHistoryRef}>
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </div>
  );
};

export default React.memo(ChatHistory);
