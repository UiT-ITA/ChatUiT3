import { 
    Message, 
    MessageRole, 
    MessageChunkType, 
    ContentType, 
    MessageChunkEvent,
    Chat,
    ChatListItem
} from "../types/chatModels";
import { 
    ApiChat, 
    ApiChatListItem, 
    ApiMessage 
} from "../types/apiTypes";

// Message creation
export function createEmptyMessage(messageId: string, isComplete: boolean): Message {
    return {
        id: messageId,
        sender: MessageRole.Assistant,
        timestamp: new Date(),
        chunks: [{ type: MessageChunkType.Text, content: '' }],
        contentType: ContentType.Text,
        isStreaming: !isComplete
    };
}

// Event creation
export function createChunkEvent(
    chatId: string,
    messageId: string,
    content: string,
    isComplete: boolean
): MessageChunkEvent {
    return {
        chatId,
        messageId,
        chunkType: MessageChunkType.Text,
        chunkIndex: 0,
        chunk: content,
        isComplete
    };
}

// Request creation
export function createChatRequest(title: string, initialMessage: string, assistantId?: string) {
    return {
        title,
        assistantId,
        messages: [{
            chunks: [{
                type: "text",
                content: initialMessage
            }]
        }]
    };
}

export function createMessageRequest(chatId: string, text: string) {
    return {
        chatId,
        chunks: [{
            type: "text",
            content: text
        }]
    };
}

// API response mapping
export function mapApiChatListItem(chat: ApiChatListItem): ChatListItem {
    return {
        id: chat.id,
        title: chat.title,
        lastUpdated: new Date(chat.lastUpdated),
        assistantId: chat.assistantId
    };
}

export function mapApiMessage(msg: ApiMessage): Message {
    return {
        id: msg.id,
        sender: msg.sender as MessageRole,
        timestamp: new Date(msg.timestamp),
        contentType: msg.contentType as ContentType,
        chunks: msg.chunks.map(chunk => ({
            type: chunk.type as MessageChunkType,
            content: chunk.content
        }))
    };
}

export function mapApiChat(chat: ApiChat): Chat {
    return {
        id: chat.id,
        title: chat.title,
        messages: chat.messages.map(mapApiMessage),
        lastUpdated: new Date(chat.lastUpdated),
        createdAt: new Date(chat.createdAt),
        assistantId: chat.assistantId
    };
}
