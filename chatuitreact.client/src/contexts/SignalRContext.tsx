import React, { createContext, useContext, useEffect, useRef, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { useAuth } from "./AuthContext";
import { chatStore } from "../stores/ChatStore";
import { createSignalRConnection, setupSignalREvents } from "../services/signalRService";

interface SignalRContextType {
  sendMessage: (chatId: string, message: string) => void;
  loadChat: (chatId: string, onNotFound?: () => void) => void;
  streamMessage: (chatId: string, messageId: string) => void;
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
      const connection = await createSignalRConnection(getAccessToken);
      if (!connection) return;

      setupSignalREvents(connection, {
        onChatCreated: (chatId: string) => {
          if (chatCreatedCallbackRef.current) {
            chatCreatedCallbackRef.current(chatId);
          }
        },
        onError: (error: any) => {
          console.error("SignalR error:", error);
        }
      }, isMounted);

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

  const streamMessage = useCallback((chatId: string, messageId: string) => {
    console.log("Streaming message:", chatId, messageId);
    connectionRef.current?.invoke("StreamMessage", chatId, messageId);
  }, []);

  const sendMessage = useCallback((chatId: string, message: string) => {
    connectionRef.current?.invoke("SendMessage", chatId, message);
  }, []);

  return (
    <SignalRContext.Provider value={{ 
      sendMessage,
      loadChat,
      streamMessage,
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
