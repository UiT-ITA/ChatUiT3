import * as signalR from "@microsoft/signalr";
import { ChatListItem, Chat } from "../types/chatModels";
import { chatStore } from "../stores/ChatStore";

interface SignalREventCallbacks {
  onChatCreated: (chatId: string) => void;
  onError: (error: any) => void;
}

export const createSignalRConnection = async (getAccessToken: () => Promise<string | null>) => {
  const token = await getAccessToken();
  if (!token) return null;

  const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chatHub", { accessTokenFactory: () => token })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Error)
    .build();

  return connection;
};

export const setupSignalREvents = (
  connection: signalR.HubConnection,
  callbacks: SignalREventCallbacks,
  isMounted: boolean
) => {
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
      chatStore.updateMessageChunk(messageId, chunk);
    }
  });

  connection.on("ChatUpdated", (chat: Chat) => {
    //console.log("Raw chat data received:", JSON.stringify(chat, null, 2));
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
        callbacks.onError(err);
      }
    }
  });
  
  connection.on("ChatCreated", (chatId: string) => {
    if (isMounted) {
      console.log("New chat created with ID:", chatId);
      callbacks.onChatCreated(chatId);
    }
  });
};
