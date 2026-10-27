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

/** Where a tool's code runs. camelCase on the wire. */
export type ToolExecution = "server" | "client";

/**
 * The lifecycle of one tool call. Persisted history only holds the terminal states
 * (completed, rejected, timeout, error); the awaiting states exist on the live stream.
 */
export type ToolCallStatus =
  | "running"
  | "awaitingConfirmation"
  | "awaitingClient"
  | "approved"
  | "completed"
  | "rejected"
  | "timeout"
  | "error";

export const TERMINAL_TOOL_STATUSES: ReadonlySet<ToolCallStatus> = new Set(["completed", "rejected", "timeout", "error"]);

export function isAwaitingStatus(status: ToolCallStatus): boolean {
  return status === "awaitingConfirmation" || status === "awaitingClient";
}

export interface ToolPreviewFieldDto {
  label: string;
  value: string;
  multiline: boolean;
}

/** What the user sees before approving a confirmable tool call. */
export interface ToolPreviewDto {
  title: string;
  /** Markdown, optional. */
  summary: string | null;
  fields: ToolPreviewFieldDto[];
  allowEdit: boolean;
}

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
  /** Tool: where the tool ran. */
  execution: ToolExecution;
  /** Tool: terminal in persisted history. */
  status: ToolCallStatus;
  /** Tool: the preview shown for a confirmation, when there was one. */
  preview: ToolPreviewDto | null;
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

export type ChatStreamChunkKind =
  | "Text"
  | "Thinking"
  | "ToolStart"
  | "ToolEnd"
  | "Done"
  /** Run paused: the user must approve or reject the call. */
  | "ToolConfirmationRequested"
  /** Run paused: this client must run the tool and post the result. */
  | "ToolClientCallRequested"
  /** Status-only update (approved). */
  | "ToolStatus";

/**
 * One event on a message's live stream. `elapsedMs` is measured on the server.
 * Per kind: ToolStart carries execution; the two pause kinds carry timeoutMs (counted from
 * elapsedMs) plus preview / argumentsJson; ToolStatus and ToolEnd carry status.
 */
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
  execution: ToolExecution | null;
  status: ToolCallStatus | null;
  preview: ToolPreviewDto | null;
  timeoutMs: number | null;
}

/** A tool the client offers to run itself for one message. Names must match /^client_[a-z0-9_]{1,50}$/. */
export interface ClientToolDeclarationDto {
  name: string;
  description: string;
  /** A JSON Schema object. */
  parametersSchema: Record<string, unknown>;
}

export type ToolCallResponseDto =
  | { kind: "confirmation"; decision: "approve" | "reject"; editedArgumentsJson: string | null }
  | { kind: "clientResult"; result: string; isError: boolean };

export interface ToolCallResponseResultDto {
  accepted: boolean;
  status: ToolCallStatus | null;
}

export interface ChatMessageDto {
  id: string;
  role: AiChatRole;
  timestamp: string;
  content: string;
  status: AiChatStatus;
  files: ChatFileDto[];
  /** Set on assistant messages; absent or null when no activity was recorded. */
  activity?: MessageActivityDto | null;
  /**
   * The assistant that produced this message, stamped when it was created. Empty on user
   * messages and on any message carrying no attribution — fall back to the conversation's
   * assistant in that case.
   */
  assistantId: string;
  /** Snapshot of the assistant's name, so a rename or deletion does not blank out history. */
  assistantName: string;
  /** Token counting scheme id → tokens this message costs. A missing key means not yet counted. */
  tokenCounts: Record<string, number>;
  /** The attachment share of tokenCounts per scheme; empty when the message has no files. */
  fileTokenCounts: Record<string, number>;
  optimistic?: boolean;
}

export interface ChatHeaderDto {
  id: string;
  assistantId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: AiChatStatus;
  isFavorite: boolean;
  /** Whether the user has allowed red data. Without it the chat is at most yellow. Never switched off. */
  redEnabled: boolean;
  /** On-demand assistant files the model pinned to this chat. Token counts are per scheme id. */
  loadedFiles: ChatLoadedFileDto[];
}

export interface ChatLoadedFileDto {
  fileId: string;
  sourceFilename: string;
  tokenCounts: Record<string, number>;
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
  /** Client tools available for this message. Not stored. */
  clientTools?: ClientToolDeclarationDto[] | null;
  /** The browser's IANA time zone, for knowledge sources that depend on "today". Not stored. */
  timeZone?: string;
}


export interface CreateChatDto {
  assistantId: string;
  redEnabled?: boolean;
}

export interface UpdateChatDto {
  name?: string;
  isFavorite?: boolean;
  redEnabled?: boolean;
  /** With redEnabled: the picked assistant the chat switches to. */
  assistantId?: string;
}
