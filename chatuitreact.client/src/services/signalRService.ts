import * as signalR from "@microsoft/signalr";
import { ChatListItem } from "../types/chatModels";

class SignalRService {
    private connection: signalR.HubConnection | null = null;
    private chatList: ChatListItem[] = [];
    private chatListSubscribers: ((chats: ChatListItem[]) => void)[] = [];
    private getAccessToken: () => Promise<string | null>;

    constructor(getAccessToken: () => Promise<string | null>) {
        this.getAccessToken = getAccessToken;
    }

    async start(): Promise<void> {
        if (this.connection) return;

        try {
            const token = await this.getAccessToken();

            if (!token) {
                throw new Error("Authentication required to connect to SignalR hub");
            }

            this.connection = new signalR.HubConnectionBuilder()
                .withUrl("/testAuthHub", {
                    accessTokenFactory: () => token
                })
                .configureLogging(signalR.LogLevel.Error)
                .withAutomaticReconnect({
                    nextRetryDelayInMilliseconds: retryContext => {
                        if (retryContext.previousRetryCount === 0) {
                            return 0; // First retry immediately
                        }
                        const delay = Math.min(1000 * Math.pow(2, retryContext.previousRetryCount), 30000);
                        return delay;
                    }
                })
                .build();

            this.connection.on("ChatListUpdated", (chats: any[]) => {
                this.chatList = chats.map(chat => ({
                    id: chat.id,
                    name: chat.name,
                    createdAt: new Date(chat.createdAt),
                    updatedAt: new Date(chat.updatedAt),
                    status: chat.status
                }));
                this.notifySubscribers();
            });

            this.connection.onreconnecting(error => {
                console.warn("Reconnecting to SignalR hub...", error);
            });

            this.connection.onreconnected(() => {
                console.log("Reconnected to SignalR hub");
            });

            this.connection.onclose(error => {
                console.error("SignalR connection closed", error);
                this.connection = null;
            });

            await this.connection.start();
        } catch (error) {
            console.error("SignalR Connection Error:", error);
            throw error;
        }
    }

    private notifySubscribers(): void {
        this.chatListSubscribers.forEach(callback => callback(this.chatList));
    }

    subscribeToChatList(callback: (chats: ChatListItem[]) => void): () => void {
        this.chatListSubscribers.push(callback);
        callback(this.chatList); // Immediately notify with current state
        return () => {
            this.chatListSubscribers = this.chatListSubscribers.filter(cb => cb !== callback);
        };
    }

    async stop(): Promise<void> {
        if (this.connection) {
            await this.connection.stop();
            this.connection = null;
        }
    }

    getChatList(): ChatListItem[] {
        return [...this.chatList]; // Return a copy of the chat list
    }
}

export default SignalRService;
