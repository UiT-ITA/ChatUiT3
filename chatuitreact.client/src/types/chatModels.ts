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

export interface ChatFileDto {
  id: string;
  filename?: string | null;
  type: AiContentType;
  content: string;
  chunks?: any[] | null;
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
}

export interface ChatDto extends ChatHeaderDto {
  messages: ChatMessageDto[];
}

export interface CreateChatFileDto {
  filename?: string | null;
  type: AiContentType;
  content: string;
  chunks?: any[] | null;
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
