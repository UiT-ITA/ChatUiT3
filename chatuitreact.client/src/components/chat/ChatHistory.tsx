import React, { useLayoutEffect, useRef } from 'react';
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

  const scrollToBottomIfNearBottom = () => {
    if (!chatHistoryRef.current) return;
    const threshold = 50; // px from bottom to still auto-scroll
    const { scrollTop, scrollHeight, clientHeight } = chatHistoryRef.current;
    // If user is within threshold px of the bottom, scroll to bottom
    if (scrollHeight - scrollTop - clientHeight < threshold) {
      scrollToBottom();
    }
  };

  useLayoutEffect(() => {
    // const lastMessage = messages[messages.length - 1];
    // if (lastMessage?.status === ChatStatus.Generating) {
    //   scrollToBottomIfNearBottom();
    // } else {
      scrollToBottom();
    // }
  }, [messages]);

  return (
    <div className="chat-history" ref={chatHistoryRef}>
      {messages.map((message) => (
        <ChatMessage
          key={message.id}
          message={message}
          onStreamingChunk={scrollToBottomIfNearBottom}
        />
      ))}
    </div>
  );
};

export default React.memo(ChatHistory);
