import { useEffect, useState } from "react";
import { ChatListItem } from "../../types/chatModels";
import { useChatService } from "../../contexts/ChatServiceContext";

export const ChatList = () => {
    const chatService = useChatService();
    const [chats, setChats] = useState<ChatListItem[]>([]);

    useEffect(() => {
        const unsubscribe = chatService.subscribeToChatList(setChats);
        return () => unsubscribe();
    }, [chatService]);

    if (!chats.length) {
        return (
            <div className="p-4 text-gray-500">
                No chats yet
            </div>
        );
    }

    return (
        <div className="overflow-y-auto">
            {chats.map(chat => (
                <div 
                    key={chat.id}
                    className="p-4 hover:bg-gray-100 cursor-pointer border-b border-gray-200"
                >
                    <div className="font-medium truncate">{chat.name}</div>
                    <div className="text-sm text-gray-500">
                        {new Date(chat.updatedAt).toLocaleDateString()}
                    </div>
                </div>
            ))}
        </div>
    );
};
