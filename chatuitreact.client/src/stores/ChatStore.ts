import { CachedChatItem, Message } from '../types/chatModels';

class ChatStore {
  private chats = new Map<string, CachedChatItem>();
  private activeChatId: string | null = null;
  private listeners = new Set<() => void>();

  setChats(chatList: CachedChatItem[]) {
    chatList.forEach(chat => {
      const existingChat = this.chats.get(chat.id);
      this.chats.set(chat.id, {
        ...chat,
        messages: existingChat?.messages || chat.messages,
        settings: existingChat?.settings || chat.settings,
        lastViewed: existingChat?.lastViewed || chat.lastViewed
      });
    });
    this.notifyListeners();
  }

  updateMessageChunk(chatId: string, messageId: string, chunk: string) {
    const chat = this.chats.get(chatId);
    if (!chat?.messages) return;

    const messageIndex = chat.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const updatedMessage = {
      ...chat.messages[messageIndex],
      content: chat.messages[messageIndex].content + chunk
    };

    const updatedMessages = [...chat.messages];
    updatedMessages[messageIndex] = updatedMessage;

    const updatedChat = {
      ...chat,
      messages: updatedMessages
    };

    this.chats.set(chatId, updatedChat);
    
    // Always notify listeners when chunks arrive for any chat
    this.notifyListeners();
  }

  updateChat(chat: CachedChatItem) {
    this.chats.set(chat.id, chat);
    this.notifyListeners();
  }

  setActiveChatId(chatId: string | null) {
    this.activeChatId = chatId;
    this.notifyListeners();
  }

  getActiveChatId(): string | null {
    return this.activeChatId;
  }

  getActiveChat(): CachedChatItem | null {
    if (!this.activeChatId) return null;
    return this.chats.get(this.activeChatId) || null;
  }

  getChatList(): CachedChatItem[] {
    return Array.from(this.chats.values());
  }

  getChat(chatId: string): CachedChatItem | undefined {
    return this.chats.get(chatId);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }
}

export const chatStore = new ChatStore();
