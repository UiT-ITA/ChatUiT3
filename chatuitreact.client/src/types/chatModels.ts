export interface ChatListItem {
    id: string;
    title: string;
    lastUpdated: Date;
}

export interface Chat extends ChatListItem {
    messages: Message[];
}

export interface Message {
    id: string;
    sender: MessageRole;
    timestamp: Date;
    chunks: MessageChunk[];
    messageStatus: MessageStatus;
    filename?: string;
}

export interface MessageChunk {
    type: ContentType;
    content: string;
}

export enum MessageRole {
    User = "user",
    Assistant = "assistant",
    System = "system",
    Tool = "tool",
    File = "file"
}

export enum MessageStatus {
    Sending = "streaming",
    Sent = "sent",
    Error = "error",
    Cancelled = "cancelled"
}

export enum ContentType {
    Text = "text",
    Image = "image"
}


