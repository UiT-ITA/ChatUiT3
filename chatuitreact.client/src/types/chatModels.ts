// Message chunk types
export enum MessageChunkType {
  Text = 'text',
  Image = 'image'
}

// Content type enum
export enum ContentType {
  Text = 'text',
  Image = 'image',
  Mixed = 'mixed'
}

// Message role enum
export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
  System = 'system',
  File = 'file',
  Tool = 'tool'
}

// Message chunk model
export interface MessageChunk {
  type: MessageChunkType;
  content: string; // Text content or base64-encoded image
}

// Server response message model (with IDs)
export interface Message {
  id: string; // From server
  sender: MessageRole;
  timestamp: Date;
  chunks: MessageChunk[];
  contentType: ContentType;
  filename?: string;
  isStreaming?: boolean;
}

// Message without ID - for requests
export interface MessageRequest {
  chunks: MessageChunk[];
  sender: MessageRole;
  filename?: string;
}

// Chat model (from server)
export interface Chat {
  id: string; // From server
  title: string;
  messages: Message[];
  assistantId?: string;
  lastUpdated?: Date;
  createdAt: Date;
}

// Chat list item model
export interface ChatListItem {
  id: string; // From server
  title: string;
  lastUpdated: Date;
  assistantId?: string;
  isUpdating?: boolean;
}

// Request models (no IDs)
export interface CreateChatRequest {
  title: string;
  assistantId?: string;
}

export interface CreateMessageRequest {
  chatId: string; // Reference to existing chat ID
  chunks: MessageChunk[];
  filename?: string;
}

// Chat update status
export type ChatUpdateStatus = 'idle' | 'updating';

// Event model for streaming message chunks
export interface MessageChunkEvent {
  chatId: string;
  messageId: string;
  chunk: string;
  isComplete: boolean;
}

// Helper functions
export const getTextFromMessage = (message: Message): string => {
  return message.chunks
    .filter(chunk => chunk.type === MessageChunkType.Text)
    .map(chunk => chunk.content)
    .join('\n');
};

export const getImageFromMessage = (message: Message): string | null => {
  const imageChunk = message.chunks.find(chunk => chunk.type === MessageChunkType.Image);
  return imageChunk ? imageChunk.content : null;
};

// Helper functions that create message requests (not messages with IDs)
export const createTextMessageRequest = (
  text: string, 
  sender: MessageRole = MessageRole.User
): MessageRequest => {
  return {
    sender,
    chunks: [{ type: MessageChunkType.Text, content: text }]
  };
};

export const createImageMessageRequest = (
  base64Image: string, 
  sender: MessageRole = MessageRole.User
): MessageRequest => {
  return {
    sender,
    chunks: [{ type: MessageChunkType.Image, content: base64Image }]
  };
};

export const createTextAndImageMessageRequest = (
  text: string,
  base64Image: string,
  sender: MessageRole = MessageRole.User
): MessageRequest => {
  return {
    sender,
    chunks: [
      { type: MessageChunkType.Text, content: text },
      { type: MessageChunkType.Image, content: base64Image }
    ]
  };
};

export const createFileMessageRequest = (
  filename: string,
  chunks: MessageChunk[]
): MessageRequest => {
  return {
    sender: MessageRole.File,
    chunks,
    filename
  };
};
