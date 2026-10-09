/**
 * Items and stream events of the ChatUiT Responses API (`/api/v1/responses`).
 * Input items follow the wire contract exactly, because the server rejects anything else.
 */

export type MessageRole = "user" | "assistant" | "system" | "developer";

export interface TextPart {
  type: "input_text" | "output_text";
  text: string;
}

export interface MessageItem {
  type: "message";
  role: MessageRole;
  content: string | Array<TextPart | FilePart>;
}

/**
 * A file the user attached to a message: its name and the text and pictures the pane read from it. The server
 * puts it in the message as ChatUiT's chat does.
 */
export interface FilePart {
  type: "input_file";
  filename: string;
  chunks: Array<TextPart | ImagePart>;
}

export interface FunctionCallItem {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
}

/** A picture in a tool's output, as a base64 data URL. */
export interface ImagePart {
  type: "input_image";
  image_url: string;
}

export interface FunctionCallOutputItem {
  type: "function_call_output";
  call_id: string;
  /** The result as JSON text, or that text followed by the pictures the tool returned. */
  output: string | Array<TextPart | ImagePart>;
}

/** The text of a function_call_output, without its pictures. */
export function outputText(output: FunctionCallOutputItem["output"]): string {
  return typeof output === "string"
    ? output
    : output.flatMap((part) => (part.type === "input_image" ? [] : [part.text])).join("\n");
}

/** `encrypted_content` is sealed by the server and must be sent back unchanged. */
export interface ReasoningItem {
  type: "reasoning";
  id: string;
  encrypted_content: string;
}

/** A tool the server ran itself, such as `m365_reader`. */
export interface McpCallItem {
  type: "mcp_call";
  id: string;
  server_label: string;
  name: string;
  arguments: string;
  output?: string;
  error?: string;
}

export type ApprovalKind = "consent" | "confirmation";

export interface ApprovalPreviewField {
  label: string;
  value: string;
  multiline: boolean;
}

export interface ApprovalPreview {
  title: string;
  summary?: string;
  fields: ApprovalPreviewField[];
  allow_edit: boolean;
}

/** `id` is sealed by the server. */
export interface McpApprovalRequestItem {
  type: "mcp_approval_request";
  id: string;
  server_label: string;
  name: string;
  arguments: string;
  chatuit_kind: ApprovalKind;
  chatuit_required_scopes?: string[];
  chatuit_preview?: ApprovalPreview;
}

export interface McpApprovalResponseItem {
  type: "mcp_approval_response";
  approval_request_id: string;
  approve: boolean;
  /** A JSON object string. Only allowed when the request's preview has `allow_edit`. */
  chatuit_edited_arguments?: string;
}

export type InputItem =
  | MessageItem
  | FunctionCallItem
  | FunctionCallOutputItem
  | ReasoningItem
  | McpCallItem
  | McpApprovalRequestItem
  | McpApprovalResponseItem;

/** Output items carry a few fields that are not sent back (`id` on messages, `status`). */
export type OutputMessageItem = {
  type: "message";
  id?: string;
  role: MessageRole;
  status?: string;
  content: Array<TextPart | { type: string; text?: string }>;
};

export type OutputFunctionCallItem = FunctionCallItem & { id?: string; status?: string };

export type OutputReasoningItem = {
  type: "reasoning";
  id: string;
  summary?: Array<{ type: string; text: string }>;
  encrypted_content?: string | null;
};

export type OutputMcpCallItem = Omit<McpCallItem, "output" | "error"> & {
  output?: string | null;
  error?: string | null;
  status?: string;
};

export type OutputMcpApprovalRequestItem = Omit<
  McpApprovalRequestItem,
  "chatuit_required_scopes" | "chatuit_preview"
> & {
  chatuit_required_scopes?: string[] | null;
  chatuit_preview?: (Omit<ApprovalPreview, "summary"> & { summary?: string | null }) | null;
};

export type OutputItem =
  OutputMessageItem | OutputFunctionCallItem | OutputReasoningItem | OutputMcpCallItem | OutputMcpApprovalRequestItem;

export interface ResponseObject {
  id: string;
  object: "response";
  created_at: number;
  status: string;
  model: string;
  output: OutputItem[];
  usage: null;
  error?: { message?: string; code?: string | null } | null;
}

export interface FunctionToolParam {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface CreateResponseRequest {
  model: string;
  /** Appended to the agent's system prompt by the server. */
  instructions?: string;
  input: InputItem[];
  tools?: FunctionToolParam[];
}

interface ItemEvent {
  output_index: number;
  item_id: string;
}

/** The stream events the client acts on. Any other event type is ignored. */
export type StreamEvent =
  | { type: "response.created" | "response.in_progress"; response: ResponseObject }
  | {
      type: "response.output_item.added" | "response.output_item.done";
      output_index: number;
      item: OutputItem;
    }
  | (ItemEvent & {
      type: "response.content_part.added" | "response.content_part.done";
      content_index: number;
      part: TextPart;
    })
  | (ItemEvent & { type: "response.output_text.delta"; content_index: number; delta: string })
  | (ItemEvent & { type: "response.output_text.done"; content_index: number; text: string })
  | (ItemEvent & { type: "response.function_call_arguments.delta"; delta: string })
  | (ItemEvent & { type: "response.function_call_arguments.done"; arguments: string })
  | (ItemEvent & {
      type: "response.mcp_call.in_progress" | "response.mcp_call.completed" | "response.mcp_call.failed";
    })
  | (ItemEvent & {
      type: "response.reasoning_summary_part.added" | "response.chatuit_mcp_call.reasoning_summary_part.added";
      summary_index: number;
    })
  | (ItemEvent & {
      type: "response.reasoning_summary_text.delta" | "response.chatuit_mcp_call.reasoning_summary_text.delta";
      summary_index: number;
      delta: string;
    })
  | (ItemEvent & { type: "response.reasoning_summary_text.done"; summary_index: number; text: string })
  /** ChatUiT extension: a server tool that is an agent called one of its functions. Name only. */
  | (ItemEvent & { type: "response.chatuit_mcp_call.inner_call"; name: string })
  | { type: "response.completed" | "response.failed"; response: ResponseObject }
  | { type: "error"; message: string; code?: string | null };
