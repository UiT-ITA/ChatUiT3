import { CachedChatItem, Message } from '../types/chatModels';

class ChatStore {
  private chats = new Map<string, CachedChatItem>();
  private activeChatId: string | null = null;
  private streamingMessages = new Map<string, string>();
  
  private chatListeners = new Set<() => void>();
  private streamingListeners = new Map<string, Set<() => void>>();
  private streamMessageCallback: ((chatId: string, messageId: string) => void) | null = null;

  setStreamMessageCallback(callback: (chatId: string, messageId: string) => void) {
    this.streamMessageCallback = callback;
  }

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
    this.notifyChatListeners();
  }

  updateMessageChunk(chatId: string, messageId: string, chunk: string) {
    if (!this.streamingMessages.has(messageId)) {
      this.streamingMessages.set(messageId, chunk);
    } else {
      const existing = this.streamingMessages.get(messageId)!;
      this.streamingMessages.set(messageId, existing + chunk);
    }
    this.notifyStreamingListeners(messageId);
  }

  updateChat(chat: CachedChatItem) {
    if (chat.messages) {
      chat.messages.forEach(msg => {
        if (msg.status === 'Generating' && !this.streamingMessages.has(msg.id)) {
          this.streamingMessages.set(msg.id, msg.content || '');
          if (this.streamMessageCallback) {
            this.streamMessageCallback(chat.id, msg.id);
          }
        } else if (msg.status !== 'Generating' && this.streamingMessages.has(msg.id)) {
          this.streamingMessages.delete(msg.id);
          this.cleanupStreamingListeners(msg.id);
        }
      });
    }

    this.chats.set(chat.id, chat);
    this.notifyChatListeners();
  }

  setActiveChatId(chatId: string | null) {
    this.activeChatId = chatId;
    this.notifyChatListeners();
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

  getStreamingContent(messageId: string): string | null {
    return this.streamingMessages.get(messageId) || null;
  }

  subscribeToChatUpdates(listener: () => void): () => void {
    this.chatListeners.add(listener);
    return () => {
      this.chatListeners.delete(listener);
    };
  }

  subscribeToStreamingUpdates(messageId: string, listener: () => void): () => void {
    if (!this.streamingListeners.has(messageId)) {
      this.streamingListeners.set(messageId, new Set());
    }
    this.streamingListeners.get(messageId)!.add(listener);
    
    return () => {
      const messageListeners = this.streamingListeners.get(messageId);
      if (messageListeners) {
        messageListeners.delete(listener);
        if (messageListeners.size === 0) {
          this.streamingListeners.delete(messageId);
        }
      }
    };
  }

  private notifyChatListeners() {
    this.chatListeners.forEach(listener => listener());
  }

  private notifyStreamingListeners(messageId: string) {
    const messageListeners = this.streamingListeners.get(messageId);
    if (messageListeners) {
      messageListeners.forEach(listener => listener());
    }
  }

  private cleanupStreamingListeners(messageId: string) {
    this.streamingListeners.delete(messageId);
  }
}

export const chatStore = new ChatStore();
