import { Chat, ChatListItem } from "../types/chatModels";

class CacheService {
    private chatCache = new Map<string, Chat>();
    private chatListCache: ChatListItem[] = [];
    private lastChatListRefresh = 0;

    // Chat list cache
    public getCachedChatList(): ChatListItem[] {
        return this.chatListCache;
    }

    public setCachedChatList(chats: ChatListItem[]): void {
        this.chatListCache = chats;
        this.lastChatListRefresh = Date.now();
    }

    public isChatListStale(maxAge: number = 10 * 60 * 1000): boolean {
        return (Date.now() - this.lastChatListRefresh) > maxAge;
    }

    public isRefreshNeeded(minInterval: number): boolean {
        return (Date.now() - this.lastChatListRefresh) > minInterval;
    }

    // Individual chat cache
    public getCachedChat(id: string): Chat | undefined {
        return this.chatCache.get(id);
    }

    public setCachedChat(id: string, chat: Chat): void {
        this.chatCache.set(id, chat);
    }

    public isChatCached(id: string): boolean {
        return this.chatCache.has(id);
    }

    public invalidateChat(id?: string): void {
        if (id) {
            this.chatCache.delete(id);
        } else {
            this.chatCache.clear();
        }
    }
}

const cacheService = new CacheService();
export default cacheService;
