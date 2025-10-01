import * as signalR from "@microsoft/signalr";
import authService from "./authService";
import { invalidateChat, invalidateChats, receiveMessageChunk, setStreamMessageCallback } from "./chatService";
import { invalidateAssistants } from "./assistantService";
import { addNotification } from "./notificationService";
import type { NotifyLevel } from "../types/notification";

class SignalrService {
  private static instance: SignalrService;
  private connection: signalR.HubConnection | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  public static getInstance(): SignalrService {
    if (!SignalrService.instance) {
      SignalrService.instance = new SignalrService();
    }
    return SignalrService.instance;
  }

  private constructor() {}

  public async ensureConnection(): Promise<void> {
    if (this.isInitialized && this.isConnected()) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initialize();
    await this.initPromise;
    this.initPromise = null;
  }

  private async initialize(): Promise<void> {
    try {
      const token = await authService.getAccessToken();
      if (!token) {
        throw new Error("No access token available");
      }

      // Only create connection if it doesn't exist or is disconnected
      if (!this.connection || this.connection.state === signalR.HubConnectionState.Disconnected) {
        this.connection = new signalR.HubConnectionBuilder()
          .withUrl("/chathub", {
            accessTokenFactory: () => authService.getAccessToken().then(t => t || "")
          })
          .withAutomaticReconnect()
          .configureLogging(signalR.LogLevel.Warning)
          .build();

        this.registerEventHandlers();
      }

      if (this.connection.state === signalR.HubConnectionState.Disconnected) {
        await this.connection.start();
      }

      while (this.connection.state !== signalR.HubConnectionState.Connected) {
        if (this.connection.state === signalR.HubConnectionState.Disconnected) {
          throw new Error("Connection failed");
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      this.isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize SignalR connection:", error);
      throw error;
    }
  }

  private registerEventHandlers(): void {
    if (!this.connection) return;

    const streamMessageCallback = async (messageId: string) => {
      if (this.connection?.state === signalR.HubConnectionState.Connected) {
        this.connection.invoke("StreamMessage", messageId);
      }
    };
    setStreamMessageCallback(streamMessageCallback);

    this.connection.on("ChatUpdated", (chatId: string) => {
      invalidateChat(chatId);
    });

    this.connection.on("ChatListUpdated", () => {
      invalidateChats();
    });

    this.connection.on("AssistantsUpdated", () => {
      invalidateAssistants();
    });

    this.connection.on("Notify", (level: NotifyLevel, message: string) => {
      console.log("Notification received:", level, message);
      addNotification({ level, message });
    });

    this.connection.on("ReceiveMessageChunk", (messageId: string, chunk: string) => {
      receiveMessageChunk(messageId, chunk);
    });

  }

  public isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  public getConnectionState(): string {
    return this.connection?.state || "Disconnected";
  }

  // Clean shutdown for app termination
  public async shutdown(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
const signalrService = SignalrService.getInstance();
export default signalrService;
