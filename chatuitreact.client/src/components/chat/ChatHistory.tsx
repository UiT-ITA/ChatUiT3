import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import './ChatHistory.css';
import type { Message } from '../../types/chatModels';


interface ChatHistoryProps {
  messages: Message[];
}

const ChatHistory = ({ messages }: ChatHistoryProps) => {
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]); // Dependency array includes messages, so it runs when messages change

  return (
    <div className="chat-history" ref={chatHistoryRef}>
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </div>
  );
};

export default ChatHistory;
