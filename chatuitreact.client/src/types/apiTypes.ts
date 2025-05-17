interface ApiChatListItem {
    id: string;
    title: string;
    lastUpdated: string;
}

interface ApiChat {
    id: string;
    title: string;
    messages: ApiMessage[];
    lastUpdated: string;
    assistantId?: string;
}

interface ApiMessage {
    id: string;
    sender: string;
    timestamp: string;
    contentType: string;
    chunks: Array<{
        type: "text" | "image";
        content: string;
    }>;
}

export type {
    ApiChatListItem,
    ApiChat,
    ApiMessage,
};
