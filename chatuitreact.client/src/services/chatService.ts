import { 
    Chat, 
    ChatListItem, 
    Message, 
    MessageChunkEvent,
    ChatStatus
} from "../types/chatModels";
import {
    ApiChat,
    ApiChatListItem,
    ApiMessage,
    ApiMessageResponse
} from "../types/apiTypes";
import signalRService from "./signalRService";
import apiService from "./apiService";
import cacheService from "./cacheService";
import authService from "./authService";
import {
    createEmptyMessage,
    createChunkEvent,
    createChatRequest,
    createMessageRequest,
    mapApiChat,
    mapApiChatListItem,
    mapApiMessage
} from "../utils/chatUtils";

class ChatService {
    // State management
    private activeChats = new Set<string>();
    private chatListFetchInProgress = false;

    // Event handlers
    private chatListUpdatedHandlers: ((chats: ChatListItem[]) => void)[] = [];
    private chatStatusHandlers: ((chatId: string, status: ChatStatus) => void)[] = [];
    private messageChunkReceivedHandlers: ((event: MessageChunkEvent) => void)[] = [];
    private messageReceivedHandlers: ((chatId: string, message: Message) => void)[] = [];

    constructor() {
        this.setupSignalRHandlers();
    }

    private setupSignalRHandlers() {
        signalRService.on("ChatListUpdated", (chats: ApiChatListItem[]) => {
            const chatItems = chats.map(mapApiChatListItem);
            this.notifyChatListUpdated(chatItems);
            cacheService.setCachedChatList(chatItems);
        });

        signalRService.on("ChatStatusUpdated", (chatId: string, status: ChatStatus) => {
            if (status === 'updated' && !this.activeChats.has(chatId)) {
                cacheService.invalidateChat(chatId);
            }
            this.notifyChatStatus(chatId, status);
        });

        signalRService.on("ReceiveMessage", (chatId: string, message: ApiMessage) => {
            const messageObj = mapApiMessage(message);
            this.notifyMessageReceived(chatId, messageObj);
        });
    }

    private async getToken(): Promise<string | undefined> {
        try {
            const token = await authService.getAccessToken();
            return token || undefined;
        } catch (error) {
            console.error("Failed to get access token:", error);
            return undefined;
        }
    }

    // Connection management
    public async ensureConnected(): Promise<boolean> {
        return signalRService.ensureConnected();
    }

    public disconnect(): void {
        signalRService.disconnect();
    }

    // Chat list operations
    public async getChats(bypassCache: boolean = false): Promise<ChatListItem[]> {
        const token = await this.getToken();
        if (!token) return [];

        // Ensure SignalR connection first
        await this.ensureConnected();
        
        if (!bypassCache && !cacheService.isChatListStale()) {
            return cacheService.getCachedChatList();
        }
        
        if (this.chatListFetchInProgress) {
            return cacheService.getCachedChatList();
        }
        
        this.chatListFetchInProgress = true;
        
        try {
            const data = await apiService.get<ApiChatListItem[]>("/api/chats", token);
            const chats = data.map(mapApiChatListItem);
            cacheService.setCachedChatList(chats);
            return chats;
        } catch (error) {
            console.error("Error fetching chats:", error);
            return cacheService.getCachedChatList();
        } finally {
            this.chatListFetchInProgress = false;
        }
    }

    // Individual chat operations
    public async getChatById(id: string, forceRefresh: boolean = false): Promise<Chat | undefined> {
        const token = await this.getToken();
        if (!token) return undefined;

        // Ensure SignalR connection first
        await this.ensureConnected();

        if (!forceRefresh && cacheService.isChatCached(id)) {
            this.activeChats.add(id);
            return cacheService.getCachedChat(id);
        }

        try {
            const data = await apiService.get<ApiChat>(`/api/chats/${id}`, token);
            const chat = mapApiChat(data);
            
            cacheService.setCachedChat(id, chat);
            this.activeChats.add(id);
            
            return chat;
        } catch (error) {
            console.error(`Error fetching chat ${id}:`, error);
            return undefined;
        }
    }

    // Chat operations
    public async createChat(title: string, initialMessage: string, assistantId?: string): Promise<Chat | undefined> {
        const token = await this.getToken();
        if (!token || !initialMessage.trim()) return undefined;

        // Ensure SignalR connection first
        await this.ensureConnected();

        try {
            const request = createChatRequest(title, initialMessage, assistantId);
            const data = await apiService.post<ApiChat>("/api/chats", request, token);
            const chat = mapApiChat(data);
            return chat;
        } catch (error) {
            console.error("Error creating chat:", error);
            return undefined;
        }
    }

    public async sendMessage(chatId: string, text: string, stream: boolean = false): Promise<Message | undefined> {
        const token = await this.getToken();
        if (!token) return undefined;

        // Ensure SignalR connection first
        await this.ensureConnected();

        try {
            const request = createMessageRequest(chatId, text);
            const endpoint = stream ? "/api/chats/messages/stream" : "/api/chats/messages";
            const data = await apiService.post<ApiMessageResponse>(endpoint, request, token);
            const message = mapApiMessage(data);
            return { ...message, isStreaming: stream };
        } catch (error) {
            console.error(`Error sending message to chat ${chatId}:`, error);
            return undefined;
        }
    }

    public async sendStreamingMessage(chatId: string, text: string): Promise<Message | undefined> {
        return this.sendMessage(chatId, text, true);
    }

    public async deleteChat(chatId: string): Promise<boolean> {
        const token = await this.getToken();
        if (!token) return false;

        // Ensure SignalR connection first
        await this.ensureConnected();

        try {
            return await apiService.delete(`/api/chats/${chatId}`, token);
        } catch (error) {
            console.error(`Error deleting chat ${chatId}:`, error);
            return false;
        }
    }

    public async refreshChatList(force: boolean = false): Promise<void> {
        const token = await this.getToken();
        if (!token) return;

        const MIN_REFRESH_INTERVAL = 10 * 1000; // 10 seconds
        if (!force && !cacheService.isRefreshNeeded(MIN_REFRESH_INTERVAL)) {
            return;
        }

        await this.getChats(force);
    }

    // Event handlers
    public onChatListUpdated(handler: (chats: ChatListItem[]) => void): () => void {
        this.chatListUpdatedHandlers.push(handler);
        return () => {
            this.chatListUpdatedHandlers = this.chatListUpdatedHandlers.filter(h => h !== handler);
        };
    }

    public onChatStatus(handler: (chatId: string, status: ChatStatus) => void): () => void {
        this.chatStatusHandlers.push(handler);
        return () => {
            this.chatStatusHandlers = this.chatStatusHandlers.filter(h => h !== handler);
        };
    }

    public onMessageChunkReceived(handler: (event: MessageChunkEvent) => void): () => void {
        this.messageChunkReceivedHandlers.push(handler);
        return () => {
            this.messageChunkReceivedHandlers = this.messageChunkReceivedHandlers.filter(h => h !== handler);
        };
    }

    public onMessageReceived(handler: (chatId: string, message: Message) => void): () => void {
        this.messageReceivedHandlers.push(handler);
        return () => {
            this.messageReceivedHandlers = this.messageReceivedHandlers.filter(h => h !== handler);
        };
    }

    // Notifications
    private notifyChatListUpdated(chats: ChatListItem[]) {
        this.chatListUpdatedHandlers.forEach(handler => handler(chats));
    }

    private notifyChatStatus(chatId: string, status: ChatStatus) {
        this.chatStatusHandlers.forEach(handler => handler(chatId, status));
    }

    private notifyMessageReceived(chatId: string, message: Message) {
        this.messageReceivedHandlers.forEach(handler => handler(chatId, message));
    }

    // Utility methods
    public setActiveChatStatus(chatId: string, isActive: boolean): void {
        if (isActive) {
            this.activeChats.add(chatId);
        } else {
            this.activeChats.delete(chatId);
        }
    }

    public isChatCached(chatId: string): boolean {
        return cacheService.isChatCached(chatId);
    }

    public async openChatStream(chatId: string): Promise<void> {
        const token = await this.getToken();
        if (!token) return;

        // Ensure SignalR connection first
        await this.ensureConnected();

        const eventSource = new EventSource(
            `/api/chats/${chatId}/stream?access_token=${encodeURIComponent(token)}`,
            { withCredentials: true }
        );

        eventSource.addEventListener('metadata', (event) => {
            try {
                const data = JSON.parse(event.data);
                const { messageId, isComplete } = data;
                const emptyMessage = createEmptyMessage(messageId, isComplete);
                this.notifyMessageReceived(chatId, emptyMessage);
            } catch (error) {
                console.error('Error processing metadata event:', error);
            }
        });

        eventSource.addEventListener('chunk', (event) => {
            try {
                const data = JSON.parse(event.data);
                const { messageId, content, isComplete } = data;
                const chunkEvent = createChunkEvent(chatId, messageId, content, isComplete);
                this.messageChunkReceivedHandlers.forEach(handler => handler(chunkEvent));
            } catch (error) {
                console.error('Error processing chunk event:', error);
            }
        });

        eventSource.addEventListener('done', () => eventSource.close());
        eventSource.onerror = (error) => {
            console.error('EventSource error:', error);
            eventSource.close();
        };
    }
}

const chatService = new ChatService();
export default chatService;
