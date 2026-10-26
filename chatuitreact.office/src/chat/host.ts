import type { ComponentType } from "react";
import type { ClientToolDefinition } from "./tools/types";

/** An example task on the empty chat. Choosing it puts its prompt in the composer. */
export interface Starter {
  label: string;
  prompt: string;
}

/** What one app (Word, Excel, Teams, ...) contributes to the shared chat. */
export interface HostAdapter {
  /** Shown while the conversation is empty. */
  emptyMessage: string;
  /** Example tasks shown while the conversation is empty. */
  starters: readonly Starter[];
  /** The ChatUiT API model (agent) id. */
  model: string;
  /** The app's own rules, which the server appends to the agent's system prompt. */
  instructions: string;
  tools: readonly ClientToolDefinition[];
  /** Where the user is in the app right now (sheet and selection, slide, selected text, email). Sent with every message. */
  getContext?: () => Promise<string | null>;
  /**
   * The document (or email thread) the pane belongs to, which its saved chats are kept under. Null when it has none
   * yet, such as a file that was never saved. Chats are then not saved.
   */
  getDocumentKey?: () => Promise<string | null>;
  /** Shown in the history menu when `getDocumentKey` returns null. */
  noDocumentMessage: string;
  /** The user's name, shown in the menu. */
  getUserName?: () => Promise<string | undefined>;
  /** App-specific items in the pane's menu, as Fluent menu items. */
  MenuItems?: ComponentType;
}
