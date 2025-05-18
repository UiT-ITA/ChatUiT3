import SignalRService from "./signalRService";
import { ChatListItem } from "../types/chatModels";

class ChatService {
    private chatList: ChatListItem[] = [];
    private subscribers: ((chats: ChatListItem[]) => void)[] = [];
    private signalRService: SignalRService;

    constructor(getAccessToken: () => Promise<string | null>) {
        this.signalRService = new SignalRService(getAccessToken);

        this.signalRService.subscribeToChatList((chats) => {
            this.chatList = chats;
            this.subscribers.forEach((callback) => callback(this.chatList));
        });
    }

    subscribeToChatList(callback: (chats: ChatListItem[]) => void): () => void {
        this.subscribers.push(callback);
        callback(this.chatList);
        return () => {
            this.subscribers = this.subscribers.filter((cb) => cb !== callback);
        };
    }
}

// Export a factory function
export function createChatService(getAccessToken: () => Promise<string | null>) {
    return new ChatService(getAccessToken);
}
