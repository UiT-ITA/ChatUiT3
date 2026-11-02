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
  | "Cancelled"
  /** The run ended on tool calls that wait for the user or this client; their answers continue it. */
  | "AwaitingUser";

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
 * The lifecycle of one tool call. A message that waits holds its waiting calls in an awaiting
 * status until they are answered; every other stored call holds a terminal status. Unanswered
 * marks a call left behind by a new message; timeout only appears in older history.
 */
export type ToolCallStatus =
  | "running"
  | "awaitingConfirmation"
  | "awaitingAnswer"
  | "awaitingClient"
  | "approved"
  | "completed"
  | "rejected"
  | "unanswered"
  | "timeout"
  | "error";

export const TERMINAL_TOOL_STATUSES: ReadonlySet<ToolCallStatus> = new Set(["completed", "rejected", "unanswered", "timeout", "error"]);

export function isAwaitingStatus(status: ToolCallStatus): boolean {
  return status === "awaitingConfirmation" || status === "awaitingAnswer" || status === "awaitingClient";
}

/** What kind of action a preview shows; each kind has its own layout, general is a list of fields. */
export type ToolPreviewKind = "general" | "message" | "file" | "documentEdit" | "event";

/** What a preview field holds, so the layout of a kind can place it. */
export type ToolPreviewFieldRole =
  | "none"
  | "recipients"
  | "subject"
  | "body"
  | "attachments"
  | "path"
  | "content"
  | "document"
  | "changes"
  | "time"
  | "location"
  | "attendees";

export interface ToolPreviewFieldDto {
  label: string;
  value: string;
  multiline: boolean;
  role: ToolPreviewFieldRole;
}

/** What the user sees before approving a confirmable tool call. */
export interface ToolPreviewDto {
  title: string;
  /** Markdown, optional. */
  summary: string | null;
  fields: ToolPreviewFieldDto[];
  allowEdit: boolean;
  kind: ToolPreviewKind;
}

export interface UserQuestionOptionDto {
  label: string;
  description: string | null;
}

/** A question the model asks the user. The user can always write their own answer. */
export interface UserQuestionDto {
  question: string;
  options: UserQuestionOptionDto[];
  multiSelect: boolean;
}

/** The options the user picked, by label, and what they wrote themselves. */
export interface UserAnswerDto {
  selected: string[];
  text: string | null;
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
  /** Tool: awaiting while the message waits on it, otherwise terminal in stored history. */
  status: ToolCallStatus;
  /** Tool: the preview shown for a confirmation, when there was one. */
  preview: ToolPreviewDto | null;
  /** Tool: the questions the user was asked, when there were any. */
  questions: UserQuestionDto[] | null;
  /** Tool: what the user or this client answered a call that waited. Null while it still waits. */
  response: ToolCallResponseDto | null;
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
  /** The call waits for the user to approve or reject it. */
  | "ToolConfirmationRequested"
  /** The call waits for this client to run the tool and post the result. */
  | "ToolClientCallRequested"
  /** Status-only update (approved). */
  | "ToolStatus"
  /** The call waits for the user to answer questions. */
  | "ToolQuestionRequested"
  /** The run ended on calls that wait; carries the activity so far. */
  | "AwaitingUser"
  /** First chunk of a run that continues a message that waited; carries its activity so far. */
  | "Continued";

/**
 * One event on a message's live stream. `elapsedMs` is measured on the server, on the
 * message's timeline across runs. Per kind: ToolStart carries execution; the waiting kinds
 * carry preview, questions or argumentsJson; ToolStatus and ToolEnd carry status; Done,
 * AwaitingUser and Continued carry activity.
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
  questions: UserQuestionDto[] | null;
}

/** A tool the client offers to run itself for one message. Names must match /^client_[a-z0-9_]{1,50}$/. */
export interface ClientToolDeclarationDto {
  name: string;
  description: string;
  /** A JSON Schema object. */
  parametersSchema: Record<string, unknown>;
}

/** The answer to a call that waits. A clientResult with decision reject: the user declined the call in this client. */
export type ToolCallResponseDto =
  | { kind: "confirmation"; decision: "approve" | "reject"; editedArgumentsJson: string | null }
  /** One answer per question, null for a skipped one; `answers` null when the user answered none. */
  | { kind: "answer"; answers: (UserAnswerDto | null)[] | null }
  | { kind: "clientResult"; result: string; isError: boolean; decision?: "reject" | null };

/** An answer to one call a message waits on, sent with a new message instead of on its own. */
export interface PendingAnswerDto {
  toolCallId: string;
  response: ToolCallResponseDto;
}

/** A response plus what the run that continues the message needs from this client. */
export type RespondToToolCallDto = ToolCallResponseDto & {
  clientTools?: ClientToolDeclarationDto[] | null;
  timeZone?: string;
};

export interface ToolCallResponseResultDto {
  accepted: boolean;
  /** True when this was the last answer the message waited for and the message continues. */
  continued: boolean;
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
  /** Answers the user had given to calls the chat waits on, sent with this message instead. */
  answers?: PendingAnswerDto[] | null;
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
