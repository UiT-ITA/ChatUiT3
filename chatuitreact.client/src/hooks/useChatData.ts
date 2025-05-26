import { useState, useEffect } from 'react';
import { chatStore } from '../stores/ChatStore';
import { CachedChatItem, Message } from '../types/chatModels';

export function useChatList(): CachedChatItem[] {
  const [chatList, setChatList] = useState<CachedChatItem[]>(() => chatStore.getChatList());

  useEffect(() => {
    const unsubscribe = chatStore.subscribe(() => {
      setChatList(chatStore.getChatList());
    });
    return unsubscribe;
  }, []);

  return chatList;
}

export function useActiveChat(): CachedChatItem | null {
  const [activeChat, setActiveChat] = useState<CachedChatItem | null>(() => chatStore.getActiveChat());

  useEffect(() => {
    const unsubscribe = chatStore.subscribe(() => {
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
