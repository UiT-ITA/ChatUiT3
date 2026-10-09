import type { ComponentType } from "react";
import type { ClientToolDefinition } from "./tools/types";

/** What one app (Word, Excel, Teams, ...) contributes to the shared chat. */
export interface HostAdapter {
  /** Shown while the conversation is empty. */
  emptyMessage: string;
  /** The ChatUiT API model (agent) id. */
  model: string;
  /** The app's own rules, which the server appends to the agent's system prompt. */
  instructions: string;
  tools: readonly ClientToolDefinition[];
  /** Where the user is in the app right now (sheet and selection, slide, selected text, email). Sent with every message. */
  getContext?: () => Promise<string | null>;
  /** App-specific controls shown in the composer toolbar. */
  Settings?: ComponentType;
}
