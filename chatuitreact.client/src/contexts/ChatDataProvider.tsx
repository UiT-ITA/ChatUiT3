import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useChats, useChat, useMessages, useSendMessage, useCreateChat, useDeleteChat } from '../hooks/useChats';

interface ChatDataContextType {
  currentChatId: string | null;
  currentAssistantId: string | null;
  isSidebarOpen: boolean;
  isAssistantModalOpen: boolean;
  
  setCurrentChatId: (chatId: string | null) => void;
  setCurrentAssistantId: (assistantId: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setAssistantModalOpen: (open: boolean) => void;
  clearCurrentChat: () => void;
  
  useChats: typeof useChats;
  useChat: typeof useChat;
  useMessages: typeof useMessages;
  useSendMessage: typeof useSendMessage;
  useCreateChat: typeof useCreateChat;
  useDeleteChat: typeof useDeleteChat;
}

const ChatDataContext = createContext<ChatDataContextType | undefined>(undefined);

interface ChatDataProviderProps {
  children: ReactNode;
}

export const ChatDataProvider: React.FC<ChatDataProviderProps> = ({ children }) => {
  // Chat state
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentAssistantId, setCurrentAssistantId] = useState<string | null>(null);
  
  // UI state
  const [isSidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [isAssistantModalOpen, setAssistantModalOpen] = useState<boolean>(false);
  
  const clearCurrentChat = useCallback(() => {
    setCurrentChatId(null);
  }, []);


  const contextValue: ChatDataContextType = {
    // Chat state
    currentChatId,
    currentAssistantId,
    
    // UI state
    isSidebarOpen,
    isAssistantModalOpen,
    
    // Actions
    setCurrentChatId,
    setCurrentAssistantId,
    setSidebarOpen,
    setAssistantModalOpen,
    clearCurrentChat,
    
    // Data hooks
    useChats,
    useChat,
    useMessages,
    useSendMessage,
    useCreateChat,
    useDeleteChat,
  };

  return (
    <ChatDataContext.Provider value={contextValue}>
      {children}
    </ChatDataContext.Provider>
  );
};

export const useChatData = (): ChatDataContextType => {
  const context = useContext(ChatDataContext);
  if (context === undefined) {
    throw new Error('useChatData must be used within a ChatDataProvider');
  }
  return context;
};

// Specific hooks for easier component usage
export const useCurrentAssistant = () => {
  const { currentAssistantId, setCurrentAssistantId } = useChatData();
  return {
    currentAssistantId,
    setCurrentAssistantId,
  };
};

export const useCurrentChat = () => {
  const { currentChatId, setCurrentChatId, clearCurrentChat } = useChatData();
  return {
    currentChatId,
    setCurrentChatId,
    clearCurrentChat,
  };
};

export const useAssistantModal = () => {
  const { isAssistantModalOpen, setAssistantModalOpen } = useChatData();
  return {
    isAssistantModalOpen,
    setAssistantModalOpen,
  };
};

export const useSidebar = () => {
  const { isSidebarOpen, setSidebarOpen } = useChatData();
  return {
    isSidebarOpen,
    setSidebarOpen,
  };
};
