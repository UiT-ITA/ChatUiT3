import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { useState, useEffect } from 'react';

// TypeScript interface for chat summary
export interface ChatSummary {
    id: string;
    name: string;
    assistantName: string;
    createdAt: string;
    updatedAt: string;
    lastMessagePreview?: string;
}

export class ChatListService {
    private connection: HubConnection | null = null;
    private listeners: ((chats: ChatSummary[]) => void)[] = [];
    private chats: ChatSummary[] = [];
    private initialized = false;
    private connecting = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;

    async initialize() {
        // Prevent multiple initializations or attempts while connecting
        if (this.initialized || this.connecting) return;
        
        try {
            this.connecting = true;
            console.log('Initializing chat service...');

            // Get access token from wherever your app stores it
            const accessToken = await this.getAccessToken();

            // Create SignalR connection with better logging
            this.connection = new HubConnectionBuilder()
                .withUrl('/chatHub', { 
                    accessTokenFactory: () => accessToken 
                })
                .withAutomaticReconnect()
                .configureLogging(LogLevel.Information)
                .build();

            // Set up listeners for different chat events
            this.connection.on('ChatCreated', (chat: ChatSummary) => {
                console.log('Chat created:', chat);
                this.chats = [...this.chats, chat];
                this.notifyListeners();
            });

            this.connection.on('ChatUpdated', (chat: ChatSummary) => {
                console.log('Chat updated:', chat);
                this.chats = this.chats.map(c => c.id === chat.id ? chat : c);
                this.notifyListeners();
            });

            this.connection.on('ChatDeleted', (chatId: string) => {
                console.log('Chat deleted:', chatId);
                this.chats = this.chats.filter(c => c.id !== chatId);
                this.notifyListeners();
            });

            this.connection.on('ChatsListUpdated', (chats: ChatSummary[]) => {
                console.log('Chats list updated:', chats);
                this.chats = chats;
                this.notifyListeners();
            });

            // Start connection or fallback to HTTP
            try {
                await this.connection.start();
                console.log('Connected to chat hub successfully');
                this.initialized = true;
                this.reconnectAttempts = 0;
            } catch (error) {
                console.error('Failed to connect to SignalR hub:', error);
                console.log('Falling back to regular HTTP for fetching chats');
                // Even if SignalR fails, we can still fetch chats via HTTP
                this.connection = null; 
            }

            // Either way, fetch initial chats
            await this.fetchChats();
            this.initialized = true;
        } catch (error) {
            console.error('Error in chat service initialization:', error);
        } finally {
            this.connecting = false;
        }
    }

    private async getAccessToken(): Promise<string> {
        // Replace with your actual token acquisition logic
        // This might come from your auth context or service
        try {
            const response = await fetch('/api/auth/token');
            if (response.ok) {
                const data = await response.json();
                return data.token;
            }
            return '';
        } catch (error) {
            console.error('Error getting access token:', error);
            return '';
        }
    }

    async fetchChats() {
        try {
            console.log('Fetching chats via HTTP...');
            const response = await fetch('/api/chats', {
                headers: {
                    'Accept': 'application/json',
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                const chats = await response.json();
                console.log('Fetched chats:', chats);
                this.chats = chats;
                this.notifyListeners();
            } else {
                console.error('Error fetching chats:', response.statusText);
            }
        } catch (error) {
            console.error('Failed to fetch chats:', error);
        }
    }

    subscribe(listener: (chats: ChatSummary[]) => void) {
        // If we're not initialized yet, start initialization
        if (!this.initialized && !this.connecting) {
            this.initialize();
        }

        this.listeners.push(listener);
        // Immediately notify with current state
        listener([...this.chats]);
        
        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener([...this.chats]));
    }

    dispose() {
        if (this.connection) {
            this.connection.stop();
        }
        this.initialized = false;
    }
}

// Create a singleton instance
export const chatListService = new ChatListService();

// React hook for easy use in components
export function useChatList() {
    const [chats, setChats] = useState<ChatSummary[]>([]);

    useEffect(() => {
        // The subscribe function will initialize if needed
        const unsubscribe = chatListService.subscribe(setChats);
        return unsubscribe;
    }, []);

    return chats;
}