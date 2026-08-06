export type AiChatRole =
  | "User"
  | "Assistant"
  | "System"
  | "ToolRequest"
  | "ToolResponse";

export type AiChatStatus =
  | "New"
  | "Generating"
  | "Success"
  | "Error"
  | "Cancelled";

export type AiContentType = "Text" | "Image" | "Mixed";

export interface ChatFileChunkDto {
  type: 'text' | 'image';
  text?: string;
  format?: 'plain' | 'markdown';
  base64?: string;
}

export interface ChatFileDto {
  id: string;
  sourceFilename: string;
  chunks: ChatFileChunkDto[];
}

export interface ChatMessageDto {
  id: string;
  role: AiChatRole;
  timestamp: string;
  content: string;
  status: AiChatStatus;
  files: ChatFileDto[];
}

export interface ChatHeaderDto {
  id: string;
  assistantId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: AiChatStatus;
  isFavorite: boolean;
}

export interface ChatDto extends ChatHeaderDto {
  messages: ChatMessageDto[];
}

export interface CreateChatFileDto {
  sourceFilename: string;
  chunks: ChatFileChunkDto[];
}

export interface SendMessageDto {
  role?: AiChatRole;
  content: string;
  files?: CreateChatFileDto[] | null;
  assistantId: string;
}


export interface CreateChatDto {
  assistantId: string;
  messages: SendMessageDto[];
}

export interface UpdateChatDto {
  name?: string;
  isFavorite?: boolean;
}
