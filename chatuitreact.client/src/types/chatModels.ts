import type { ReasoningEffort } from "./assistantModels";

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

export type ActivityEntryType = "Thinking" | "Tool";

/**
 * One step of a generation. The server sends every field for both kinds, so this is the
 * wire shape rather than a union; `type` says which fields are meaningful.
 */
export interface ActivityEntryDto {
  type: ActivityEntryType;
  /** Milliseconds since generation start. */
  startedMs: number;
  /** Null while the step is still running. */
  endedMs: number | null;
  /** Thinking: the summary text as markdown. */
  text: string | null;
  toolCallId: string | null;
  toolName: string | null;
  argumentsJson: string | null;
  result: string | null;
  isError: boolean;
}

/** What happened while an assistant message was generated. Shown to the user, never sent to the model. */
export interface MessageActivityDto {
  model: string;
  effort: ReasoningEffort;
  thinkingMs: number;
  toolMs: number;
  totalMs: number;
  toolRounds: number;
  entries: ActivityEntryDto[];
}

export type ChatStreamChunkKind = "Text" | "Thinking" | "ToolStart" | "ToolEnd" | "Done";

/** One event on a message's live stream. `elapsedMs` is measured on the server. */
export interface ChatStreamChunk {
  kind: ChatStreamChunkKind;
  elapsedMs: number;
  text: string | null;
  toolCallId: string | null;
  toolName: string | null;
  argumentsJson: string | null;
  result: string | null;
  isError: boolean;
  activity: MessageActivityDto | null;
}

export interface ChatMessageDto {
  id: string;
  role: AiChatRole;
  timestamp: string;
  content: string;
  status: AiChatStatus;
  files: ChatFileDto[];
  /** Present on assistant messages generated after activity tracking existed. */
  activity?: MessageActivityDto | null;
  /**
   * The assistant that produced this message, stamped when it was created. Empty on user
   * messages and on messages written before per-message attribution existed — fall back to
   * the conversation's assistant in that case.
   */
  assistantId: string;
  /** Snapshot of the assistant's name, so a rename or deletion does not blank out history. */
  assistantName: string;
  /** Token counting scheme id → tokens this message costs. A missing key means not yet counted. */
  tokenCounts: Record<string, number>;
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
