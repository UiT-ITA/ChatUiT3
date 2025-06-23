import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { useAuth } from "./AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useChatData } from "./ChatDataProvider";
import { createSignalRConnection, setupSignalREvents } from "../services/signalRService";
import { chatKeys } from "../hooks/useChats";
import { assistantKeys } from "../hooks/useAssistantsQuery";

interface SignalRContextType {
  loadChat: (chatId: string, onNotFound?: () => void) => void;
  streamMessage: (chatId: string, messageId: string) => void;
  isConnected: boolean;
  onChatCreated: (callback: (chatId: string) => void) => void;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

export const SignalRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken, isInitializing } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const chatCreatedCallbackRef = useRef<((chatId: string) => void) | null>(null);
  const queryClient = useQueryClient();
  const { updateMessageChunk } = useChatData();

  const onChatCreated = useCallback((callback: (chatId: string) => void) => {
    chatCreatedCallbackRef.current = callback;
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    let isMounted = true;
    
    const connect = async () => {
      const connection = await createSignalRConnection(getAccessToken);
      if (!connection) return;

      // Set up notification event listeners
      connection.on("ChatUpdated", (chatId: string) => {
        // console.log("Chat updated:", chatId);
        // Invalidate specific chat data
        queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
        queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      });

      connection.on("ChatListUpdated", () => {
        // console.log("Chat list updated");
        // Invalidate chat list
        queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
      });

      connection.on("AssistantsChanged", () => {
        // console.log("Assistants changed");
        // Invalidate assistants data
        queryClient.invalidateQueries({ queryKey: assistantKeys.lists() });
      });

      connection.on("ReceiveMessageChunk", (_chatId: string, messageId: string, chunk: string) => {
        // Handle message streaming via ChatDataProvider
        updateMessageChunk(messageId, chunk);
      });

      connection.on("Error", (message: string) => {
        console.error("SignalR error:", message);
      });

      // Set up other chat events
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
  }, [getAccessToken, isInitializing, updateMessageChunk]);

  const loadChat = useCallback((chatId: string, onNotFound?: () => void) => {
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
    connectionRef.current?.invoke("StreamMessage", chatId, messageId);
  }, []);


  return (
    <SignalRContext.Provider value={{ 
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
