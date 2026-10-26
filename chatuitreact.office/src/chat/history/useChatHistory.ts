/* global console, crypto */

import { useCallback, useEffect, useRef } from "react";
import type { InputItem } from "../api/types";
import { CONTEXT_PREFIX, isBusy, type Conversation, type ConversationState } from "../conversation/conversation";
import { listChats, loadChat, saveChat, type SavedChatSummary } from "./historyStore";

/** The saved chats of the pane's document, or null when the document has no key yet. */
export type ChatList = SavedChatSummary[] | null;

export interface ChatHistory {
  /** Stops and saves the current chat, then starts a new one. */
  startNew(): Promise<void>;
  /** Stops and saves the current chat, then opens a saved one. */
  open(id: string): Promise<void>;
  list(): Promise<ChatList>;
}

/** The chat being shown: its id, its document key once it is read, and the items saved last. */
interface CurrentChat {
  id: string;
  /** Read when the chat's first message is sent. Resolves to null when the document has no key yet. */
  documentKey: Promise<string | null> | null;
  savedItems: readonly InputItem[];
}

const TITLE_LENGTH = 80;

function newChat(): CurrentChat {
  return { id: crypto.randomUUID(), documentKey: null, savedItems: [] };
}

/**
 * Saves the conversation under the pane's document whenever it stops (done, stopped, failed or waiting for an
 * approval), and opens saved chats. A chat belongs to the document that was open when its first message was sent.
 */
export function useChatHistory(
  state: ConversationState,
  conversation: Conversation,
  getDocumentKey: (() => Promise<string | null>) | undefined
): ChatHistory {
  const chat = useRef<CurrentChat>(newChat());
  /** The items being saved or saved last, so the same items are not saved twice. */
  const pendingItems = useRef<readonly InputItem[] | null>(null);
  /** The saves in order, so a later one never overtakes an earlier one. */
  const saving = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    chat.current = newChat();
    pendingItems.current = null;
  }, [conversation]);

  const save = useCallback(
    (current: ConversationState): Promise<void> => {
      if (!getDocumentKey || isBusy(current) || current.items.length === 0 || current.items === pendingItems.current) {
        return saving.current;
      }
      const target = chat.current;
      const { items, thoughts, activity, turns } = current;
      pendingItems.current = items;
      saving.current = saving.current
        .then(async () => {
          const documentKey = await (target.documentKey ?? getDocumentKey());
          if (!documentKey) {
            // Read again on the next change: the file may have been saved meanwhile.
            target.documentKey = null;
            if (pendingItems.current === items) {
              pendingItems.current = null;
            }
            return;
          }
          target.documentKey = Promise.resolve(documentKey);
          await saveChat(
            {
              id: target.id,
              documentKey,
              title: titleOf(items),
              updatedAt: Date.now(),
              conversation: { items, thoughts, activity, turns },
            },
            target.savedItems
          );
          target.savedItems = items;
        })
        .catch((error: unknown) => {
          // Saved again on the next change, or when the chat is left.
          if (pendingItems.current === items) {
            pendingItems.current = null;
          }
          console.warn("The chat could not be saved.", error);
        });
      return saving.current;
    },
    [getDocumentKey]
  );

  // The document key is read as the first message is sent, before the user can move to another document or email.
  useEffect(() => {
    if (getDocumentKey && state.items.length > 0 && !chat.current.documentKey) {
      chat.current.documentKey = getDocumentKey().catch(() => null);
    }
    void save(state);
  }, [state, getDocumentKey, save]);

  /** Stops a running reply, so its turn is recorded, and saves the chat before it is replaced. */
  const leave = useCallback(async () => {
    await conversation.stop();
    await save(conversation.getState());
  }, [conversation, save]);

  const startNew = useCallback(async () => {
    await leave();
    conversation.reset();
    chat.current = newChat();
    pendingItems.current = null;
  }, [conversation, leave]);

  const open = useCallback(
    async (id: string) => {
      await leave();
      const saved = await loadChat(id).catch((error: unknown) => {
        console.warn("The chat could not be opened.", error);
        return undefined;
      });
      if (!saved) {
        return;
      }
      chat.current = {
        id: saved.id,
        documentKey: Promise.resolve(saved.documentKey),
        savedItems: saved.conversation.items,
      };
      pendingItems.current = saved.conversation.items;
      conversation.load(saved.conversation);
    },
    [conversation, leave]
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
