import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/apiService';
import { Chat, Message, ChatFile } from '../types/chatModels';

// Query keys for consistent caching
export const chatKeys = {
  all: ['chats'] as const,
  lists: () => [...chatKeys.all, 'list'] as const,
  list: (filters: string) => [...chatKeys.lists(), { filters }] as const,
  details: () => [...chatKeys.all, 'detail'] as const,
  detail: (id: string) => [...chatKeys.details(), id] as const,
  messages: (id: string) => [...chatKeys.detail(id), 'messages'] as const,
};

// Get all chats
export const useChats = (enabled = true) => {
  return useQuery({
    queryKey: chatKeys.lists(),
    queryFn: () => apiService.getChats(),
    enabled,
  });
};

// Get specific chat
export const useChat = (chatId: string | null, enabled = true) => {
  return useQuery({
    queryKey: chatKeys.detail(chatId || ''),
    queryFn: () => apiService.getChat(chatId!),
    enabled: !!chatId && chatId !== 'new' && enabled,
  });
};

// Get messages for a chat
export const useMessages = (chatId: string | null, page = 1, size = 50, enabled = true) => {
  return useQuery({
    queryKey: [...chatKeys.messages(chatId || ''), page, size],
    queryFn: () => apiService.getMessages(chatId!, page, size),
    enabled: !!chatId && chatId !== 'new' && enabled,
  });
};

export const useCreateChat = () => {
  return useMutation({
    mutationFn: ({ assistantId, initialMessages }: { assistantId?: string; initialMessages?: Message[] }) =>
      apiService.createChat(assistantId, initialMessages),
  });
};

export const useSendMessage = () => {
  return useMutation({
    mutationFn: ({ chatId, content, files, assistantId }: { 
      chatId: string; 
      content: string; 
      files?: ChatFile[]; 
      assistantId?: string; 
    }) => apiService.sendMessage(chatId, content, files, assistantId),
  });
};

// Delete chat
export const useDeleteChat = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (chatId: string) => apiService.deleteChat(chatId),
    onSuccess: (_, chatId) => {
      // Remove from chats list
      queryClient.setQueryData(chatKeys.lists(), (old: Chat[] = []) => 
        old.filter(chat => chat.id !== chatId)
      );
      // Remove cached chat data
      queryClient.removeQueries({ queryKey: chatKeys.detail(chatId) });
      queryClient.removeQueries({ queryKey: chatKeys.messages(chatId) });
    },
  });
};
