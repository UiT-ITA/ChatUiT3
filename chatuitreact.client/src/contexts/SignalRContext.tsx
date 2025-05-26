import React, { createContext, useContext, useEffect, useRef, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { useAuth } from "./AuthContext";
import { ChatListItem, Chat } from "../types/chatModels";
import { chatStore } from "../stores/ChatStore";

interface SignalRContextType {
  sendMessage: (chatId: string, message: string) => void;
  loadChat: (chatId: string, onNotFound?: () => void) => void;
  isConnected: boolean;
  onChatCreated: (callback: (chatId: string) => void) => void;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

export const SignalRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken, isInitializing } = useAuth();
  const [isConnected, setIsConnected] = React.useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const chatCreatedCallbackRef = useRef<((chatId: string) => void) | null>(null);

  const onChatCreated = useCallback((callback: (chatId: string) => void) => {
    chatCreatedCallbackRef.current = callback;
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    let isMounted = true;
    
    const connect = async () => {
      const token = await getAccessToken();
      if (!token) return;

      const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub", { accessTokenFactory: () => token })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Error)
        .build();

      connection.on("ChatListUpdated", (chats: ChatListItem[]) => {
        if (isMounted) {
          const cachedChats = chats.map(chat => ({
            ...chat,
            createdAt: new Date(chat.createdAt),
            updatedAt: new Date(chat.updatedAt)
          }));
          chatStore.setChats(cachedChats);
        }
      });

      connection.on("ReceiveMessageChunk", (chatId: string, messageId: string, chunk: string) => {
        if (isMounted) {
          chatStore.updateMessageChunk(chatId, messageId, chunk);
        }
      });

      connection.on("ChatUpdated", (chat: Chat) => {
        if (isMounted) {
          try {
            const processedChat = {
              ...chat,
              createdAt: new Date(chat.createdAt),
              updatedAt: new Date(chat.updatedAt),
              messages: chat.messages.map(msg => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              })),
              lastViewed: new Date()
            };
            
            chatStore.updateChat(processedChat);
          } catch (err) {
            console.error("Error processing chat update:", err);
          }
        }
      });
      
      connection.on("ChatCreated", (chatId: string) => {
        if (isMounted && chatCreatedCallbackRef.current) {
          console.log("New chat created with ID:", chatId);
          chatCreatedCallbackRef.current(chatId);
        }
      });

      await connection.start();
      connectionRef.current = connection;
      setIsConnected(true);
    };

    connect();

    return () => {
      isMounted = false;
      if (connectionRef.current) {
        setIsConnected(false);
        connectionRef.current.stop();
      }
    };
  }, [getAccessToken, isInitializing]);

  const loadChat = useCallback((chatId: string, onNotFound?: () => void) => {
    chatStore.setActiveChatId(chatId);
    
    const existingChat = chatStore.getChat(chatId);
    if (existingChat) {
      const updatedChat = {
        ...existingChat,
        lastViewed: new Date()
      };
      chatStore.updateChat(updatedChat);
    }
    
    connectionRef.current?.invoke("JoinChat", chatId)
      .catch(error => {
        if (error.message.includes("ChatNotFound")) {
          onNotFound?.();
        } else {
          console.error("Error loading chat:", error);
        }
      });
  }, []);

  const sendMessage = useCallback((chatId: string, message: string) => {
    connectionRef.current?.invoke("SendMessage", chatId, message);
  }, []);

  return (
    <SignalRContext.Provider value={{ 
      sendMessage,
      loadChat,
      isConnected,
      onChatCreated
    }}>
      {children}
    </SignalRContext.Provider>
  );
};

export function useSignalR() {
  const ctx = useContext(SignalRContext);
  if (!ctx) throw new Error("useSignalR must be used within a SignalRProvider");
  return ctx;
}
