import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from "react";
import * as signalR from "@microsoft/signalr";
import { useAuth } from "./AuthContext";
import { chatStore } from "../stores/ChatStore";
import { createSignalRConnection, setupSignalREvents } from "../services/signalRService";
import type { AssistantListDto, CreateAssistantDto, UpdateAssistantDto, ModelDto } from '../types/dtos';

interface SignalRContextType {
  sendMessage: (chatId: string, message: string, assistantId?: string) => void;
  loadChat: (chatId: string, onNotFound?: () => void) => void;
  streamMessage: (chatId: string, messageId: string) => void;
  isConnected: boolean;
  onChatCreated: (callback: (chatId: string) => void) => void;
  getUserAssistants: () => void;
  createAssistant: (createDto: CreateAssistantDto) => void;
  updateAssistant: (updateDto: UpdateAssistantDto) => void;
  deleteAssistant: (assistantId: string) => void;
  toggleAssistantVisibility: (assistantId: string) => void;
  addSharedAssistant: (assistantId: string) => void;
  assistantList: AssistantListDto | null;
  isLoadingAssistants: boolean;
  getAvailableModels: () => Promise<ModelDto[]>;
}

const SignalRContext = createContext<SignalRContextType | undefined>(undefined);

export const SignalRProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getAccessToken, isInitializing } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [assistantList, setAssistantList] = useState<AssistantListDto | null>(null);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const chatCreatedCallbackRef = useRef<((chatId: string) => void) | null>(null);

  const onChatCreated = useCallback((callback: (chatId: string) => void) => {
    chatCreatedCallbackRef.current = callback;
  }, []);

  const getAvailableModels = useCallback(async (): Promise<ModelDto[]> => {
    if (!connectionRef.current) return [];
    try {
      return await connectionRef.current.invoke("GetAvailableModels");
    } catch (error) {
      console.error("Error getting available models:", error);
      return [];
    }
  }, []);

  useEffect(() => {
    if (isInitializing) return;
    let isMounted = true;
    
    const connect = async () => {
      const connection = await createSignalRConnection(getAccessToken);
      if (!connection) return;

      // Set up chat events
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

      // Set up assistant events
      connection.on('UserAssistants', (data: AssistantListDto) => {
        if (isMounted) {
          setAssistantList(data);
          setIsLoadingAssistants(false);
        }
      });

      connection.on('Error', (message: string) => {
        console.error('Assistant error:', message);
        if (isMounted) {
          setIsLoadingAssistants(false);
        }
      });

      await connection.start();
      connectionRef.current = connection;
      setIsConnected(true);

      // Load assistants when connected
      setIsLoadingAssistants(true);
      await connection.invoke('GetUserAssistants');
    };

    connect();

    return () => {
      isMounted = false;
      if (connectionRef.current) {
        setIsConnected(false);
        connectionRef.current.off('UserAssistants');
        connectionRef.current.off('Error');
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
    connectionRef.current?.invoke("StreamMessage", chatId, messageId);
  }, []);

  const sendMessage = useCallback((chatId: string, message: string, assistantId?: string) => {
    connectionRef.current?.invoke("SendMessage", chatId, message, assistantId);
  }, []);

  const getUserAssistants = useCallback(() => {
    console.log("Fetching user assistants...");
    setIsLoadingAssistants(true);
    connectionRef.current?.invoke("GetUserAssistants");
  }, []);

  const createAssistant = useCallback((createDto: CreateAssistantDto) => {
    connectionRef.current?.invoke("CreateAssistant", createDto);
  }, []);

  const updateAssistant = useCallback((updateDto: UpdateAssistantDto) => {
    connectionRef.current?.invoke("UpdateAssistant", updateDto);
  }, []);

  const deleteAssistant = useCallback((assistantId: string) => {
    connectionRef.current?.invoke("DeleteAssistant", assistantId);
  }, []);

  const toggleAssistantVisibility = useCallback((assistantId: string) => {
    connectionRef.current?.invoke("ToggleAssistantVisibility", assistantId);
  }, []);

  const addSharedAssistant = useCallback((assistantId: string) => {
    connectionRef.current?.invoke("AddSharedAssistant", assistantId);
  }, []);

  return (
    <SignalRContext.Provider value={{ 
      sendMessage,
      loadChat,
      streamMessage,
      isConnected,
      onChatCreated,
      getUserAssistants,
      createAssistant,
      updateAssistant,
      deleteAssistant,
      toggleAssistantVisibility,
      addSharedAssistant,
      assistantList,
      isLoadingAssistants,
      getAvailableModels
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
