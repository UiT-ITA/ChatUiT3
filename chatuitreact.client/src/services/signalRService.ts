import * as signalR from "@microsoft/signalr";

interface SignalREventCallbacks {
  onChatCreated: (chatId: string) => void;
  onError: (error: any) => void;
}

export const createSignalRConnection = async (getAccessToken: () => Promise<string | null>) => {
  const token = await getAccessToken();
  if (!token) return null;

  const connection = new signalR.HubConnectionBuilder()
    .withUrl("/chatHub", { accessTokenFactory: () => token })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Error)
    .build();

  return connection;
};

export const setupSignalREvents = (
  connection: signalR.HubConnection,
  callbacks: SignalREventCallbacks,
  isMounted: boolean
) => {
  // This service is now only used for legacy compatibility
  // All notification handling is done directly in SignalRContext
  
  connection.on("ChatCreated", (chatId: string) => {
    if (isMounted) {
      console.log("New chat created with ID:", chatId);
      callbacks.onChatCreated(chatId);
    }
  });
};
