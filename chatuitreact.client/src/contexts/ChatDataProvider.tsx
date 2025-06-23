import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useChats, useChat, useMessages, useSendMessage, useCreateChat, useDeleteChat } from '../hooks/useChats';

interface ChatDataContextType {
  // Chat state
  currentChatId: string | null;
  currentAssistantId: string | null;
  
  // UI state (from ChatProvider)
  isSidebarOpen: boolean;
  
  // Assistant modal state (from AssistantProvider)  
  isAssistantModalOpen: boolean;
  
  // Streaming state (from ChatStore)
  streamingMessages: Map<string, string>;
  
  // Actions
  setCurrentChatId: (chatId: string | null) => void;
  setCurrentAssistantId: (assistantId: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setAssistantModalOpen: (open: boolean) => void;
  clearCurrentChat: () => void;
  
  // Streaming actions
  updateMessageChunk: (messageId: string, chunk: string) => void;
  getStreamingContent: (messageId: string) => string | null;
  subscribeToStreamingUpdates: (messageId: string, listener: () => void) => () => void;
  
  // Data hooks (re-exported for convenience)
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
  
  // Streaming state
  const [streamingMessages, setStreamingMessages] = useState(new Map<string, string>());
  const [streamingListeners, setStreamingListeners] = useState(new Map<string, Set<() => void>>());

  const clearCurrentChat = useCallback(() => {
    setCurrentChatId(null);
  }, []);

  const updateMessageChunk = useCallback((messageId: string, chunk: string) => {
    setStreamingMessages(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(messageId)) {
        newMap.set(messageId, chunk);
      } else {
        const existing = newMap.get(messageId)!;
        newMap.set(messageId, existing + chunk);
      }
      return newMap;
    });
    
    // Notify listeners
    const messageListeners = streamingListeners.get(messageId);
    if (messageListeners) {
      messageListeners.forEach(listener => listener());
    }
  }, [streamingListeners]);

  const getStreamingContent = useCallback((messageId: string): string | null => {
    return streamingMessages.get(messageId) || null;
  }, [streamingMessages]);

  const subscribeToStreamingUpdates = useCallback((messageId: string, listener: () => void): () => void => {
    setStreamingListeners(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(messageId)) {
        newMap.set(messageId, new Set());
      }
      newMap.get(messageId)!.add(listener);
      return newMap;
    });
    
    return () => {
      setStreamingListeners(prev => {
        const newMap = new Map(prev);
        const messageListeners = newMap.get(messageId);
        if (messageListeners) {
          messageListeners.delete(listener);
          if (messageListeners.size === 0) {
            newMap.delete(messageId);
          }
        }
        return newMap;
      });
    };
  }, []);


  const contextValue: ChatDataContextType = {
    // Chat state
    currentChatId,
    currentAssistantId,
    
    // UI state
    isSidebarOpen,
    isAssistantModalOpen,
    
    // Streaming state
    streamingMessages,
    
    // Actions
    setCurrentChatId,
    setCurrentAssistantId,
    setSidebarOpen,
    setAssistantModalOpen,
    clearCurrentChat,
    
    // Streaming actions
    updateMessageChunk,
    getStreamingContent,
    subscribeToStreamingUpdates,
    
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

export const useStreamingContent = (messageId: string) => {
  const { getStreamingContent, subscribeToStreamingUpdates } = useChatData();
  return {
    content: getStreamingContent(messageId),
    subscribe: subscribeToStreamingUpdates,
  };
};
