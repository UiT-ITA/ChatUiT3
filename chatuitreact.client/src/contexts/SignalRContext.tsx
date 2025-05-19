import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { useAuth } from "./AuthContext";
import { ChatListItem } from "../types/chatModels";

interface SignalRContextType {
  chatList: ChatListItem[];
  sendMessage: (chatId: string, message: string) => void;
  // Add more methods as needed (e.g., subscribeToNotifications, sendCommand, etc.)
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

export const SignalRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken, isInitializing } = useAuth();
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    if (isInitializing) return; // Wait for initialization
    let isMounted = true;
    const connect = async () => {
      const token = await getAccessToken();
      if (!token) return;

      const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub", { accessTokenFactory: () => token })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Error)
        .build();

      connection.on("ChatListUpdated", (chats: any[]) => {
        if (isMounted) {
          setChatList(chats.map(chat => ({
            id: chat.id,
            name: chat.name,
            createdAt: new Date(chat.createdAt),
            updatedAt: new Date(chat.updatedAt),
            status: chat.status
          })));
        }
      });

      // Add more event handlers here (e.g., for notifications, chat updates, etc.)

      await connection.start();
      connectionRef.current = connection;
    };

    connect();

    return () => {
      isMounted = false;
      if (connectionRef.current) {
        connectionRef.current.stop();
      }
    };
  }, [getAccessToken]);

  // Example: send a message to the backend
  const sendMessage = useCallback((chatId: string, message: string) => {
    connectionRef.current?.invoke("SendMessage", chatId, message);
  }, []);

  // Add more methods as needed

  return (
    <SignalRContext.Provider value={{ chatList, sendMessage }}>
      {children}
    </SignalRContext.Provider>
  );
};

export function useSignalR() {
  const ctx = useContext(SignalRContext);
  if (!ctx) throw new Error("useSignalR must be used within a SignalRProvider");
  return ctx;
}