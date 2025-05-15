import * as signalR from "@microsoft/signalr";
import { Chat, ChatListItem, ChatUpdateStatus, Message, MessageChunkEvent } from "../types/chatModels";

class ChatService {
    private connection: signalR.HubConnection | null = null;
    private connectionPromise: Promise<boolean> | null = null;
    private chatListUpdatedHandlers: ((chats: ChatListItem[]) => void)[] = [];
    private messageReceivedHandlers: ((chatId: string, message: Message) => void)[] = [];
    private messageChunkReceivedHandlers: ((event: MessageChunkEvent) => void)[] = [];
    private chatUpdateStatusHandlers: ((chatId: string, status: ChatUpdateStatus) => void)[] = [];
    
    // Cache management
    private chatCache: Map<string, Chat> = new Map();
    private chatUpdateStatus: Map<string, ChatUpdateStatus> = new Map();
    private activeChats: Set<string> = new Set();
    private cacheExpiryTime: number = 30 * 60 * 1000; // 30 minutes
    private lastCacheCleanup: number = Date.now();
    private lastChatListRefresh: number = 0; // Timestamp for last chat list refresh
    
    // For preventing concurrent API calls
    private chatListFetchInProgress: boolean = false;
    private chatListCache: ChatListItem[] = [];

    private setupConnection(token: string) {
        if (this.connection) {
            return;
        }

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl('/chatHub', {
                accessTokenFactory: () => token
            })
            .configureLogging(signalR.LogLevel.Error)
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: retryContext => {
                    if (retryContext.previousRetryCount === 0) {
                        return 0;
                    }
                    return Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
                }
            })
            .build();

        this.connection.on("ChatListUpdated", (chats: any[]) => {
            const chatItems = chats.map(chat => ({
                ...chat,
                lastUpdated: new Date(chat.lastUpdated),
                isUpdating: this.chatUpdateStatus.get(chat.id) === 'updating'
            }));
            this.notifyChatListUpdated(chatItems);
            
            // Update cached chat metadata (like title) if we have them in cache
            chatItems.forEach(chatItem => {
                const cachedChat = this.chatCache.get(chatItem.id);
                if (cachedChat) {
                    cachedChat.title = chatItem.title;
                    cachedChat.lastUpdated = chatItem.lastUpdated;
                    cachedChat.assistantId = chatItem.assistantId;
                }
            });
        });

        this.connection.on("ReceiveMessage", (chatId: string, message: any) => {
            const messageObj = {
                ...message,
                timestamp: new Date(message.timestamp)
            };
            
            // Update the cache with the new message
            this.updateChatWithMessage(chatId, messageObj);
            
            // Notify listeners
            this.notifyMessageReceived(chatId, messageObj);
            
            // Set status to idle when a complete message is received
            this.setChatUpdateStatus(chatId, 'idle');
        });

        this.connection.on("ReceiveMessageChunk", (chatId: string, messageId: string, chunk: string, isComplete: boolean) => {
            // Set chat as updating when receiving chunks
            if (!isComplete) {
                this.setChatUpdateStatus(chatId, 'updating');
            } else {
                this.setChatUpdateStatus(chatId, 'idle');
            }
            
            this.notifyMessageChunkReceived({
                chatId,
                messageId,
                chunk,
                isComplete
            });
        });

        this.connection.onreconnecting(() => {
            console.log("Chat connection lost. Attempting to reconnect...");
        });

        this.connection.onreconnected(() => {
            console.log("Chat connection reestablished");
            this.refreshChatList(token);
        });

        this.connection.onclose(() => {
            console.log("Chat connection closed");
            this.connection = null;
        });
    }
    
    private updateChatWithMessage(chatId: string, message: Message) {
        const cachedChat = this.chatCache.get(chatId);
        if (cachedChat) {
            // Only add the message if it doesn't already exist
            const messageExists = cachedChat.messages.some(m => m.id === message.id);
            if (!messageExists) {
                cachedChat.messages.push(message);
                cachedChat.lastUpdated = new Date();
            }
        }
    }
    
    private setChatUpdateStatus(chatId: string, status: ChatUpdateStatus) {
        const previousStatus = this.chatUpdateStatus.get(chatId);
        if (previousStatus !== status) {
            this.chatUpdateStatus.set(chatId, status);
            this.notifyChatUpdateStatus(chatId, status);
        }
    }

    private async ensureConnected(token?: string): Promise<boolean> {
        if (!token) {
            return false;
        }

        try {
            if (this.connection && this.connection.state !== signalR.HubConnectionState.Connected) {
                try {
                    await this.connection.stop();
                    this.connection = null;
                } catch (err) {
                    console.error("Error closing previous connection:", err);
                }
            }
    
            if (!this.connection) {
                this.setupConnection(token);
            }
    
            if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
                return true;
            }
    
            if (!this.connectionPromise && this.connection) {
                this.connectionPromise = this.connection.start()
                    .then(() => {
                        this.connectionPromise = null;
                        return true;
                    })
                    .catch(err => {
                        console.error("SignalR connection failed:", err);
                        this.connectionPromise = null;
                        this.connection = null;
                        return false;
                    });
            }
    
            return this.connectionPromise ? await this.connectionPromise : false;
        } catch (error) {
            console.error("Connection error:", error);
            return false;
        }
    }
    
    /**
     * Checks if the chat list needs refreshing based on time elapsed
     * @param maxAge Maximum age in milliseconds before refresh is needed
     * @returns True if refresh is needed, false otherwise
     */
    public isChatListRefreshNeeded(maxAge: number = 10 * 60 * 1000): boolean {
        const now = Date.now();
        return (now - this.lastChatListRefresh) > maxAge || this.lastChatListRefresh === 0;
    }
    
    /**
     * Get chats from cache if available and fresh, otherwise fetch from server
     */
    public async getChats(token?: string, bypassCache: boolean = false): Promise<ChatListItem[]> {
        if (!token) {
            return [];
        }
        
        // If we have a cached response and it's fresh enough (less than 30 seconds old)
        // and we're not bypassing the cache, return the cached response
        if (!bypassCache && 
            this.chatListCache.length > 0 && 
            (Date.now() - this.lastChatListRefresh) < 30000) {
            return this.chatListCache;
        }
        
        // If there's already a fetch in progress, return cached data
        if (this.chatListFetchInProgress) {
            return this.chatListCache;
        }
        
        // Set flag to prevent concurrent calls
        this.chatListFetchInProgress = true;
        
        try {
            const response = await fetch("/api/chats", {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const chats = data.map((chat: any) => ({
                ...chat,
                lastUpdated: new Date(chat.lastUpdated)
            }));
            
            // Update cache and timestamp
            this.chatListCache = chats;
            this.lastChatListRefresh = Date.now();
            
            return chats;
        } catch (error) {
            console.error("Error fetching chats:", error);
            // Return cached data if we have any, otherwise empty array
            return this.chatListCache.length > 0 ? this.chatListCache : [];
        } finally {
            // Clear the flag to allow future fetches
            this.chatListFetchInProgress = false;
        }
    }

    public async getChatById(id: string, token?: string, forceRefresh: boolean = false): Promise<Chat | undefined> {
        if (!token) {
            return undefined;
        }

        // Check cache first if not forcing refresh
        if (!forceRefresh) {
            const cachedChat = this.chatCache.get(id);
            if (cachedChat) {
                // Mark this chat as active
                this.activeChats.add(id);
                return cachedChat;
            }
        }

        try {
            // Set the status to updating while we fetch
            this.setChatUpdateStatus(id, 'updating');
            
            const response = await fetch(`/api/chats/${id}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    this.setChatUpdateStatus(id, 'idle');
                    return undefined;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const chat: Chat = {
                ...data,
                messages: data.messages.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                })),
                lastUpdated: new Date()
            };
            
            // Store in cache
            this.chatCache.set(id, chat);
            
            // Mark as active
            this.activeChats.add(id);
            
            // Clean up old cache entries
            this.cleanupCache();
            
            // Update status
            this.setChatUpdateStatus(id, 'idle');
            
            return chat;
        } catch (error) {
            console.error(`Error fetching chat ${id}:`, error);
            this.setChatUpdateStatus(id, 'idle');
            return undefined;
        }
    }
    
    /**
     * Mark a chat as active or inactive in the tracking system
     */
    public setActiveChatStatus(chatId: string, isActive: boolean): void {
        if (isActive) {
            this.activeChats.add(chatId);
        } else {
            this.activeChats.delete(chatId);
        }
    }
    
    /**
     * Check if we have this chat in the cache
     */
    public isChatCached(chatId: string): boolean {
        return this.chatCache.has(chatId);
    }

    public async createChat(title: string, token?: string, assistantId?: string): Promise<Chat | undefined> {
        if (!token) {
            return undefined;
        }

        try {
            // Try SignalR first
            try {
                const connected = await this.ensureConnected(token);
                if (connected && this.connection) {
                    const chat = await this.connection.invoke("CreateChat", { title, assistantId });
                    return {
                        ...chat,
                        messages: chat.messages.map((msg: any) => ({
                            ...msg,
                            timestamp: new Date(msg.timestamp)
                        }))
                    };
                }
            } catch (hubError) {
                console.warn("Using REST API fallback for chat creation");
            }
            
            // REST API fallback
            const response = await fetch("/api/chats", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ title, assistantId })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            await this.refreshChatList(token);
            
            return {
                ...data,
                messages: data.messages ? data.messages.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                })) : []
            };
        } catch (error) {
            console.error("Error creating chat:", error);
            return undefined;
        }
    }

    public async sendMessage(chatId: string, text: string, token?: string, stream: boolean = false): Promise<Message | undefined> {
        if (!token) {
            return undefined;
        }

        try {
            // For streaming, we prefer the REST API to start the stream
            if (stream) {
                try {
                    const connected = await this.ensureConnected(token);
                    if (!connected) {
                        throw new Error("SignalR connection not established");
                    }
                    
                    const response = await fetch("/api/chats/messages/stream", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({ chatId, text })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    await this.refreshChatList(token);
                    
                    // Initial message placeholder that will be updated by streaming chunks
                    return {
                        ...data,
                        timestamp: new Date(data.timestamp),
                        isStreaming: true
                    };
                } catch (error) {
                    console.error(`Error starting streaming message for chat ${chatId}:`, error);
                    // Fall back to non-streaming if streaming fails
                }
            }

            // Non-streaming path or fallback
            // Try SignalR first
            try {
                const connected = await this.ensureConnected(token);
                if (connected && this.connection) {
                    const response = await this.connection.invoke("SendMessage", { chatId, text });
                    return {
                        ...response,
                        timestamp: new Date(response.timestamp)
                    };
                }
            } catch (hubError) {
                console.warn("Using REST API fallback for sending message");
            }
            
            // REST API fallback
            const response = await fetch("/api/chats/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ chatId, text })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            await this.refreshChatList(token);
            
            return {
                ...data,
                timestamp: new Date(data.timestamp)
            };
        } catch (error) {
            console.error(`Error sending message to chat ${chatId}:`, error);
            return undefined;
        }
    }

    // Method for streaming messages (uses the standard streaming endpoint)
    public async sendStreamingMessage(chatId: string, text: string, token?: string): Promise<Message | undefined> {
        if (!token) {
            return undefined;
        }

        try {
            const connected = await this.ensureConnected(token);
            if (!connected) {
                throw new Error("SignalR connection not established");
            }
            
            const response = await fetch("/api/chats/messages/stream", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ chatId, text })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // This is just the initial message - streaming chunks will update it
            return {
                ...data,
                timestamp: new Date(data.timestamp),
                isStreaming: true
            };
        } catch (error) {
            console.error(`Error starting streaming message for chat ${chatId}:`, error);
            return undefined;
        }
    }

    public async deleteChat(chatId: string, token?: string): Promise<boolean> {
        if (!token) {
            return false;
        }

        try {
            // Try SignalR first
            try {
                const connected = await this.ensureConnected(token);
                if (connected && this.connection) {
                    await this.connection.invoke("DeleteChat", chatId);
                    return true;
                }
            } catch (hubError) {
                console.warn("Using REST API fallback for chat deletion");
            }
            
            // REST API fallback
            const response = await fetch(`/api/chats/${chatId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            await this.refreshChatList(token);
            return true;
        } catch (error) {
            console.error(`Error deleting chat ${chatId}:`, error);
            return false;
        }
    }

    public async updateChatTitle(chatId: string, newTitle: string, token?: string): Promise<ChatListItem | undefined> {
        if (!token) {
            return undefined;
        }

        try {
            // Try SignalR first
            try {
                const connected = await this.ensureConnected(token);
                if (connected && this.connection) {
                    const response = await this.connection.invoke("UpdateChatTitle", chatId, newTitle);
                    return {
                        ...response,
                        lastUpdated: new Date(response.lastUpdated)
                    };
                }
            } catch (hubError) {
                console.warn("Using REST API fallback for title update");
            }
            
            // REST API fallback
            const response = await fetch(`/api/chats/${chatId}/title`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(newTitle)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            await this.refreshChatList(token);
            
            return {
                ...data,
                lastUpdated: new Date(data.lastUpdated)
            };
        } catch (error) {
            console.error(`Error updating title for chat ${chatId}:`, error);
            return undefined;
        }
    }

    /**
     * Clean up old cache entries to prevent memory leaks
     */
    private cleanupCache(): void {
        const now = Date.now();
        
        // Only run cleanup every minute
        if (now - this.lastCacheCleanup < 60000) {
            return;
        }
        
        this.lastCacheCleanup = now;
        const expiredTime = now - this.cacheExpiryTime;
        
        // Keep active chats and recently updated ones
        this.chatCache.forEach((chat, chatId) => {
            const chatLastUpdated = chat.lastUpdated?.getTime() || 0;
            const isActive = this.activeChats.has(chatId);
            
            if (!isActive && chatLastUpdated < expiredTime) {
                this.chatCache.delete(chatId);
            }
        });
    }
    
    /**
     * Refresh the chat list using the most efficient method available
     */
    public async refreshChatList(token?: string, force: boolean = false): Promise<void> {
        if (!token) {
            return;
        }

        // Skip refresh if it's been less than 10 seconds since last refresh
        // unless force=true is specified
        const MIN_REFRESH_INTERVAL = 10 * 1000; // 10 seconds
        if (!force && (Date.now() - this.lastChatListRefresh) < MIN_REFRESH_INTERVAL) {
            return;
        }
        
        // If there's already a fetch in progress, don't start another one
        if (this.chatListFetchInProgress) {
            return;
        }

        try {
            // Never discard existing data until we have new data
            // First try SignalR for the most efficient update
            let newChats: ChatListItem[] | null = null;
            
            try {
                const connected = await this.ensureConnected(token);
                if (connected && this.connection) {
                    const hubChats = await this.connection.invoke("GetChats");
                    if (hubChats && hubChats.length > 0) {
                        newChats = hubChats.map((chat: any) => ({
                            ...chat,
                            lastUpdated: new Date(chat.lastUpdated)
                        }));
                    }
                }
            } catch (hubError) {
                console.warn("SignalR chat list fetch failed, falling back to REST API:", hubError);
            }
            
            // If SignalR failed or returned no data, use REST API
            if (!newChats) {
                // Fetch using the getChats method (which has its own caching)
                newChats = await this.getChats(token, force);
            }
            
            // Only update and notify if we got data
            if (newChats && newChats.length > 0) {
                // Store clean version in cache without status flags
                this.chatListCache = newChats.map(chat => ({
                    ...chat,
                    isUpdating: undefined
                }));
                
                // Then add status for UI
                const chatsWithStatus = newChats.map(chat => ({
                    ...chat,
                    isUpdating: this.chatUpdateStatus.get(chat.id) === 'updating'
                }));
                
                // Notify subscribers with the new data
                this.notifyChatListUpdated(chatsWithStatus);
                
                // Update timestamp
                this.lastChatListRefresh = Date.now();
            }
        } catch (error) {
            console.error("Error refreshing chat list:", error);
        }
    }

    public onChatListUpdated(handler: (chats: ChatListItem[]) => void): () => void {
        this.chatListUpdatedHandlers.push(handler);
        return () => {
            this.chatListUpdatedHandlers = this.chatListUpdatedHandlers.filter(h => h !== handler);
        };
    }

    public onMessageReceived(handler: (chatId: string, message: Message) => void): () => void {
        this.messageReceivedHandlers.push(handler);
        return () => {
            this.messageReceivedHandlers = this.messageReceivedHandlers.filter(h => h !== handler);
        };
    }

    public onMessageChunkReceived(handler: (event: MessageChunkEvent) => void): () => void {
        this.messageChunkReceivedHandlers.push(handler);
        return () => {
            this.messageChunkReceivedHandlers = this.messageChunkReceivedHandlers.filter(h => h !== handler);
        };
    }
    
    public onChatUpdateStatus(handler: (chatId: string, status: ChatUpdateStatus) => void): () => void {
        this.chatUpdateStatusHandlers.push(handler);
        return () => {
            this.chatUpdateStatusHandlers = this.chatUpdateStatusHandlers.filter(h => h !== handler);
        };
    }

    private notifyChatListUpdated(chats: ChatListItem[]) {
        this.chatListUpdatedHandlers.forEach(handler => handler(chats));
    }

    private notifyMessageReceived(chatId: string, message: Message) {
        this.messageReceivedHandlers.forEach(handler => handler(chatId, message));
    }

    private notifyMessageChunkReceived(event: MessageChunkEvent) {
        this.messageChunkReceivedHandlers.forEach(handler => handler(event));
    }
    
    private notifyChatUpdateStatus(chatId: string, status: ChatUpdateStatus) {
        this.chatUpdateStatusHandlers.forEach(handler => handler(chatId, status));
    }

    public getChatUpdateStatus(chatId: string): ChatUpdateStatus {
        return this.chatUpdateStatus.get(chatId) || 'idle';
    }
    
    public invalidateCache(chatId?: string): void {
        if (chatId) {
            this.chatCache.delete(chatId);
        } else {
            this.chatCache.clear();
        }
    }

    public disconnect() {
        if (this.connection) {
            this.connection.stop().catch(err => console.error("Error stopping connection:", err));
        }
    }
}

const chatService = new ChatService();
export default chatService;
