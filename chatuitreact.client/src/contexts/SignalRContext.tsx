import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { useAuth } from "./AuthContext";
import { ChatListItem, Message } from "../types/chatModels";

interface SignalRContextType {
  chatList: ChatListItem[];
  messages: Message[];
  sendMessage: (chatId: string, message: string) => void;
  loadChat: (chatId: string) => void;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

export const SignalRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken, isInitializing } = useAuth();
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

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

      connection.on("ReceiveChatData", (chat: any) => {
        if (isMounted) {
          setMessages(chat.messages.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            timestamp: new Date(msg.timestamp),
            content: msg.content,
            status: msg.status
          })));
        }
      });

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
  }, [getAccessToken, isInitializing]);

  const loadChat = useCallback((chatId: string) => {
    connectionRef.current?.invoke("JoinChat", chatId)
      .catch(error => {
        console.error("Error loading chat:", error);
      });
  }, []);

  const sendMessage = useCallback((chatId: string, message: string) => {
    connectionRef.current?.invoke("SendMessage", chatId, message);
  }, []);

  return (
    <SignalRContext.Provider value={{ 
      chatList,
      messages,
      sendMessage,
      loadChat
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
