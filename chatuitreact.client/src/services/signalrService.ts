import * as signalR from "@microsoft/signalr";
import authService from "./authService";
import { invalidateChat, invalidateChats, receiveMessageChunk, setStreamMessageCallback } from "./chatService";
import { invalidateAssistants } from "./assistantService";

class SignalrService {
  private connection: signalR.HubConnection | null = null;
  private isConnecting: boolean = false;
  private handlersRegistered: boolean = false;

  public async startConnection(): Promise<void> {
    if (this.isConnecting) {
      return;
    }

    if (this.connection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    if (this.connection?.state === signalR.HubConnectionState.Connecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const token = await authService.getAccessToken();
      if (!token) {
        console.error("No access token found");
        return;
      }

      if (this.connection) {
        await this.connection.stop();
        this.connection = null;
        this.handlersRegistered = false;
      }

      this.connection = new signalR.HubConnectionBuilder()
        .withUrl("http://localhost:5157/chathub", {
          accessTokenFactory: () => token
        })
        .withAutomaticReconnect()
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      this.registerEventHandlers();

      await this.connection.start();
    } catch (err) {
      console.error("SignalR Connection Error: ", err);
      this.connection = null;
      this.handlersRegistered = false;
    } finally {
      this.isConnecting = false;
    }
  }

  private registerEventHandlers(): void {
    if (!this.connection || this.handlersRegistered) {
      return;
    }

    const streamMessageCallback = async (messageId: string) => {
      while (this.connection?.state !== signalR.HubConnectionState.Connected) {
        if (this.connection?.state === signalR.HubConnectionState.Disconnected) {
            console.warn("SignalR disconnected while waiting to stream:", messageId);
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      this.connection.invoke("StreamMessage", messageId);
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

    this.connection.on("ReceiveMessageChunk", (messageId: string, chunk: string) => {
      receiveMessageChunk(messageId, chunk);
    });

    this.connection.on("Error", (message: string) => {
      console.error("SignalR Error:", message);
    });

    this.handlersRegistered = true;
  }

  public async stopConnection(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      this.handlersRegistered = false;
      this.isConnecting = false;
    }
  }

  public getConnectionState(): string {
    return this.connection?.state || "Disconnected";
  }

  public isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }
}

const signalrService = new SignalrService();
export default signalrService;
