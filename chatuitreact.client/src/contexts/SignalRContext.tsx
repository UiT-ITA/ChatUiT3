import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import * as signalR from "@microsoft/signalr";
import { useAuth } from "./AuthContext";
import { ChatListItem, Message, Chat, CachedChatItem } from "../types/chatModels";

interface SignalRContextType {
  chatList: CachedChatItem[];
  messages: Message[];
  sendMessage: (chatId: string, message: string) => void;
  loadChat: (chatId: string, onNotFound?: () => void) => void;
  isConnected: boolean;
  onChatCreated: (callback: (chatId: string) => void) => void;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

export const SignalRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken, isInitializing } = useAuth();
  const [chatList, setChatList] = useState<CachedChatItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
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
          setChatList(prevChatList => {
            // Create a map of existing cached chats
            const existingChatsMap = new Map(prevChatList.map(chat => [chat.id, chat]));
            
            // Merge new chat list with existing cached data
            return chats.map(chat => {
              const existingChat = existingChatsMap.get(chat.id);
              return {
                ...chat,
                createdAt: new Date(chat.createdAt),
                updatedAt: new Date(chat.updatedAt),
                // Preserve cached messages and settings if they exist
                messages: existingChat?.messages,
                settings: existingChat?.settings,
                lastViewed: existingChat?.lastViewed
              };
            });
          });
        }
      });

      connection.on("ReceiveMessageChunk", (chatId: string, messageId: string, chunk: string) => {
        if (isMounted) {
          // Update current messages display
          setMessages(prev => prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: msg.content + chunk }
              : msg
          ));
          
          // Also update cached messages
          setChatList(prevChatList => 
            prevChatList.map(cachedChat => 
              cachedChat.id === chatId && cachedChat.messages
                ? {
                    ...cachedChat,
                    messages: cachedChat.messages.map(msg => 
                      msg.id === messageId 
                        ? { ...msg, content: msg.content + chunk }
                        : msg
                    )
                  }
                : cachedChat
            )
          );
        }
      });

      connection.on("ChatUpdated", (chat: Chat) => {
        if (isMounted) {
          try {
            const processedMessages = chat.messages.map((msg: Message) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }));
            
            // Update the current messages display
            setMessages(processedMessages);
            
            // Cache the full chat data in chatList
            setChatList(prevChatList => 
              prevChatList.map(cachedChat => 
                cachedChat.id === chat.id 
                  ? {
                      ...cachedChat,
                      ...chat,
                      createdAt: new Date(chat.createdAt),
                      updatedAt: new Date(chat.updatedAt),
                      messages: processedMessages,
                      lastViewed: new Date()
                    }
                  : cachedChat
              )
            );
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
    // Check if we have cached messages for this chat using functional state update
    setChatList(prevChatList => {
      const cachedChat = prevChatList.find(chat => chat.id === chatId);
      if (cachedChat?.messages && cachedChat.messages.length > 0) {
        // Display cached messages immediately
        setMessages(cachedChat.messages);
        
        // Update the lastViewed timestamp and return updated list
        return prevChatList.map(chat => 
          chat.id === chatId 
            ? { ...chat, lastViewed: new Date() }
            : chat
        );
      } else {
        // No cached messages, clear current messages
        setMessages([]);
        // Return unchanged list
        return prevChatList;
      }
    });
    
    // Always fetch fresh data from server regardless of cache
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
      chatList,
      messages,
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
