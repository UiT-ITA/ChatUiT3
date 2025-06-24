import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { useAuth } from "./AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { createSignalRConnection } from "../services/signalRService";
import { streamingService } from "../services/streamingService";
import { chatKeys } from "../hooks/useChats";
import { assistantKeys } from "../hooks/useAssistants";

interface SignalRContextType {
  streamMessage: (messageId: string) => void;
  isConnected: boolean;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

export const SignalRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken, isInitializing } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isInitializing) return;
    let isMounted = true;
    
    const connect = async () => {
      const connection = await createSignalRConnection(getAccessToken);
      if (!connection || !isMounted) return;

      // Set up notification event listeners
      connection.on("ChatUpdated", (chatId: string) => {
        queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
        queryClient.invalidateQueries({ queryKey: chatKeys.messages(chatId) });
      });

      connection.on("ChatListUpdated", () => {
        queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
      });

      connection.on("AssistantsUpdated", () => {
        queryClient.invalidateQueries({ queryKey: assistantKeys.lists() });
      });

      connection.on("ReceiveMessageChunk", (messageId: string, chunk: string) => {
        streamingService.addChunk(messageId, chunk);
      });

      connection.on("Error", (message: string) => {
        console.error("SignalR error:", message);
      });

      await connection.start();
      if (!isMounted) return;
      
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

  const streamMessage = useCallback((messageId: string) => {
    connectionRef.current?.invoke("StreamMessage", messageId);
  }, []);


  return (
    <SignalRContext.Provider value={{ 
      streamMessage,
      isConnected
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
