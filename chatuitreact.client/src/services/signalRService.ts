import * as signalR from "@microsoft/signalr";
import authService from "./authService";

type Handler = (...args: any[]) => void;

class SignalRService {
    private connection: signalR.HubConnection | null = null;
    private pendingHandlers: { event: string; handler: Handler }[] = [];
    private connectionPromise: Promise<boolean> | null = null;

    private async waitForAuth(): Promise<void> {
        // Create a promise that resolves when auth is initialized
        return new Promise<void>((resolve) => {
            const checkAuth = () => {
                // Check if auth is initialized by checking if we can get an account without error
                const account = authService.getAccount();
                if (account !== null) {
                    resolve();
                } else {
                    // If not initialized or no account, try again in 100ms
                    setTimeout(checkAuth, 100);
                }
            };
            checkAuth();
        });
    }

    private async getToken(): Promise<string> {
        try {
            // Wait for auth to be initialized
            await this.waitForAuth();
            
            const token = await authService.getAccessToken();
            if (!token) {
                throw new Error("No token available");
            }
            return token;
        } catch (error) {
            console.error("Failed to get access token:", error);
            throw error;
        }
    }

    public async ensureConnected(): Promise<boolean> {
        // If we're already connecting, return the existing promise
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        // Create a new connection attempt
        this.connectionPromise = this.tryConnect();

        try {
            const result = await this.connectionPromise;
            this.connectionPromise = null;
            return result;
        } catch (error) {
            this.connectionPromise = null;
            throw error;
        }
    }

    private async tryConnect(): Promise<boolean> {
        try {
            // If already connected, return true
            if (this.connection?.state === signalR.HubConnectionState.Connected) {
                return true;
            }

            // Try to get token first to fail fast
            try {
                await this.getToken();
            } catch (error: unknown) {
                return false;
            }

            // If connection exists but not connected, stop it
            if (this.connection) {
                await this.connection.stop();
                this.connection = null;
            }

            // Create new connection
            this.connection = new signalR.HubConnectionBuilder()
                .withUrl('/chatHub', {
                    accessTokenFactory: () => this.getToken()
                })
                .withAutomaticReconnect()
                .build();

            // Register any pending handlers
            this.pendingHandlers.forEach(({ event, handler }) => {
                this.connection?.on(event, handler);
            });

            await this.connection.start();
            return true;
        } catch (error) {
            console.error("SignalR connection failed:", error);
            this.connection = null;
            return false;
        }
    }

    public on(event: string, handler: Handler): void {
        // Store handler for reconnection
        this.pendingHandlers.push({ event, handler });

        // If we have a connection, register the handler
        if (this.connection) {
            this.connection.on(event, handler);
            return;
        }

        // Try to connect and register handler
        const tryRegister = async () => {
            try {
                await this.ensureConnected();
            } catch (error) {
                console.error("Failed to connect while registering handler:", error);
            }
        };

        tryRegister();
    }

    public disconnect(): void {
        if (this.connection) {
            this.connection.stop().catch(err => console.error("Error stopping connection:", err));
            this.connection = null;
        }
        this.pendingHandlers = [];
    }
}

const signalRService = new SignalRService();
export default signalRService;
