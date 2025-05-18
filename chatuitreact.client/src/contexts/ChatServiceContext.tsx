import React, { createContext, useContext } from "react";
import { createChatService } from "../services/chatService";
import { useAuth } from "./AuthContext";

const ChatServiceContext = createContext<ReturnType<typeof createChatService> | null>(null);

export const ChatServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { getAccessToken } = useAuth();
    const chatService = React.useMemo(() => createChatService(getAccessToken), [getAccessToken]);
    return (
        <ChatServiceContext.Provider value={chatService}>
            {children}
        </ChatServiceContext.Provider>
    );
};

export function useChatService() {
    const ctx = useContext(ChatServiceContext);
    if (!ctx) throw new Error("useChatService must be used within ChatServiceProvider");
    return ctx;
}