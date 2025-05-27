import { CachedChatItem, Message } from '../types/chatModels';

class ChatStore {
  private chats = new Map<string, CachedChatItem>();
  private activeChatId: string | null = null;
  private streamingMessages = new Map<string, string>(); // messageId -> accumulated content
  
  private listeners = new Set<() => void>();
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
    this.notifyListeners();
  }

  updateMessageChunk(chatId: string, messageId: string, chunk: string) {
    if (!this.streamingMessages.has(messageId)) {
      this.streamingMessages.set(messageId, chunk);
    } else {
      const existing = this.streamingMessages.get(messageId)!;
      this.streamingMessages.set(messageId, existing + chunk);
    }
    this.notifyListeners();
  }

  updateChat(chat: CachedChatItem) {
    // Check for new "Generating" messages and start streaming
    if (chat.messages) {
      chat.messages.forEach(msg => {
        if (msg.status === 'Generating' && !this.streamingMessages.has(msg.id)) {
          // New generating message - start streaming
          this.streamingMessages.set(msg.id, msg.content || '');
          if (this.streamMessageCallback) {
            this.streamMessageCallback(chat.id, msg.id);
          }
        } else if (msg.status !== 'Generating' && this.streamingMessages.has(msg.id)) {
          // Message completed - clean up streaming
          this.streamingMessages.delete(msg.id);
        }
      });
    }

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

  getMessageContent(messageId: string): string | null {
    return this.streamingMessages.get(messageId) || null;
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
