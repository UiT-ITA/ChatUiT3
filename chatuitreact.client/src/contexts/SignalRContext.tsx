import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { useAuth } from "./AuthContext";
import { ChatListItem, Message, ChatRole, ChatStatus } from "../types/chatModels";

interface SignalRContextType {
  chatList: ChatListItem[];
  messages: Message[];
  sendMessage: (chatId: string, message: string) => void;
  loadChat: (chatId: string) => void;
  isConnected: boolean;
}

interface AiChat {
  id: string;
  messages: Message[];
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

export const SignalRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken, isInitializing } = useAuth();
  const [chatList, setChatList] = useState<ChatListItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
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
            status: chat.status === 0 ? ChatStatus.New : chat.status === 1 ? ChatStatus.Generating : chat.status === 2 ? ChatStatus.Success : chat.status === 3 ? ChatStatus.Error : ChatStatus.Cancelled
          })));
        }
      });

      connection.on("ReceiveChatData", (chat: any) => {
        if (isMounted) {
          try {
            setMessages(chat.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role === 0 ? ChatRole.User : msg.role === 1 ? ChatRole.Assistant : ChatRole.System,
              timestamp: new Date(msg.timestamp),
              content: msg.content,
              status: msg.status === 0 ? ChatStatus.New : msg.status === 1 ? ChatStatus.Generating : msg.status === 2 ? ChatStatus.Success : msg.status === 3 ? ChatStatus.Error : ChatStatus.Cancelled
            })));
          } catch (err) {
            console.error("Error processing chat data:", err);
          }
        }
      });

      connection.on("ReceiveMessageChunk", (chatId: string, messageId: string, chunk: string) => {
        if (isMounted && chatId === currentChatId) {
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: msg.content + chunk }
              : msg
          ));
        }
      });

      connection.on("ChatUpdated", (chat: any) => {
        if (isMounted && chat.id === currentChatId) {
          try {
            setMessages(chat.messages.map((msg: any) => ({
              id: msg.id,
              role: msg.role === 0 ? ChatRole.User : msg.role === 1 ? ChatRole.Assistant : ChatRole.System,
              timestamp: new Date(msg.timestamp),
              content: msg.content,
              status: msg.status === 0 ? ChatStatus.New : msg.status === 1 ? ChatStatus.Generating : msg.status === 2 ? ChatStatus.Success : msg.status === 3 ? ChatStatus.Error : ChatStatus.Cancelled
            })));
          } catch (err) {
            console.error("Error processing chat update:", err);
          }
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

  const loadChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
    setMessages([]); // Clear messages before loading new chat
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
      loadChat,
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
