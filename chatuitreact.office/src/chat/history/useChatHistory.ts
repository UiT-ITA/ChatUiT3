/* global console, crypto */

import { useCallback, useEffect, useRef } from "react";
import type { InputItem } from "../api/types";
import { CONTEXT_PREFIX, isBusy, type Conversation, type ConversationState } from "../conversation/conversation";
import { listChats, loadChat, saveChat, type SavedChatSummary } from "./historyStore";

/** The saved chats of the pane's document, or null when the document has no key yet. */
export type ChatList = SavedChatSummary[] | null;

export interface ChatHistory {
  /** Starts a new chat. The current one stays saved. */
  startNew(): void;
  open(id: string): Promise<void>;
  list(): Promise<ChatList>;
}

const TITLE_LENGTH = 80;

/**
 * Saves the conversation under the pane's document whenever it stops (done, stopped, failed or waiting for an
 * approval), and opens saved chats. A chat keeps the document key it was first saved under.
 */
export function useChatHistory(
  state: ConversationState,
  conversation: Conversation,
  getDocumentKey: (() => Promise<string | null>) | undefined
): ChatHistory {
  const chat = useRef<{ id: string; documentKey: string | null }>({ id: crypto.randomUUID(), documentKey: null });
  const savedItems = useRef<readonly InputItem[] | null>(null);

  const forget = useCallback(() => {
    chat.current = { id: crypto.randomUUID(), documentKey: null };
    savedItems.current = null;
  }, []);

  useEffect(forget, [conversation, forget]);

  useEffect(() => {
    if (!getDocumentKey || isBusy(state) || state.items.length === 0 || state.items === savedItems.current) {
      return;
    }
    const current = chat.current;
    const { items, thoughts, activity, turns } = state;
    savedItems.current = items;
    void (async () => {
      const documentKey = current.documentKey ?? (await getDocumentKey());
      if (!documentKey) {
        savedItems.current = null;
        return;
      }
      current.documentKey = documentKey;
      await saveChat({
        id: current.id,
        documentKey,
        title: titleOf(items),
        updatedAt: Date.now(),
        conversation: { items, thoughts, activity, turns },
      });
    })().catch((error: unknown) => console.warn("The chat could not be saved.", error));
  }, [state, getDocumentKey]);

  const startNew = useCallback(() => {
    conversation.reset();
    forget();
  }, [conversation, forget]);

  const open = useCallback(
    async (id: string) => {
      const saved = await loadChat(id);
      if (!saved) {
        return;
      }
      chat.current = { id: saved.id, documentKey: saved.documentKey };
      savedItems.current = saved.conversation.items;
      conversation.load(saved.conversation);
    },
    [conversation]
  );

  const list = useCallback(async (): Promise<ChatList> => {
    const documentKey = await getDocumentKey?.();
    return documentKey ? listChats(documentKey) : null;
  }, [getDocumentKey]);

  return { startNew, open, list };
}

/** The first user message's text, or the name of its first file, shortened. */
function titleOf(items: readonly InputItem[]): string {
  const first = items.find((item) => item.type === "message" && item.role === "user");
  if (first?.type !== "message") {
    return "";
  }
  const content = first.content;
  const text =
    typeof content === "string"
      ? content
      : (content
          .map((part) =>
            part.type === "input_file" ? part.filename : part.text.startsWith(CONTEXT_PREFIX) ? "" : part.text
          )
          .find((value) => value.trim() !== "") ?? "");
  const line = text.trim().replace(/\s+/g, " ");
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line;
}
