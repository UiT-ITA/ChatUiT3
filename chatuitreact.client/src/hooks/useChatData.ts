import { useState, useEffect } from 'react';
import { chatStore } from '../stores/ChatStore';
import { CachedChatItem, Message } from '../types/chatModels';

export function useChatList(): CachedChatItem[] {
  const [chatList, setChatList] = useState<CachedChatItem[]>(() => chatStore.getChatList());

  useEffect(() => {
    const unsubscribe = chatStore.subscribeToChatUpdates(() => {
      setChatList(chatStore.getChatList());
    });
    return unsubscribe;
  }, []);

  return chatList;
}

export function useActiveChat(): CachedChatItem | null {
  const [activeChat, setActiveChat] = useState<CachedChatItem | null>(() => chatStore.getActiveChat());

  useEffect(() => {
    const unsubscribe = chatStore.subscribeToChatUpdates(() => {
      setActiveChat(chatStore.getActiveChat());
    });
    return unsubscribe;
  }, []);

  return activeChat;
}

export function useActiveChatMessages(): Message[] {
  const activeChat = useActiveChat();
  return activeChat?.messages || [];
}

export function useStreamingContent(messageId: string): string {
  const [content, setContent] = useState<string>(() => {
    return chatStore.getStreamingContent(messageId) || '';
  });

  useEffect(() => {
    const unsubscribe = chatStore.subscribeToStreamingUpdates(messageId, () => {
      setContent(chatStore.getStreamingContent(messageId) || '');
    });
    return unsubscribe;
  }, [messageId]);

  return content;
}

export function useMessageContent(messageId: string): string {
  const activeChat = useActiveChat();
  const message = activeChat?.messages?.find(m => m.id === messageId);
  return message?.content || '';
}
