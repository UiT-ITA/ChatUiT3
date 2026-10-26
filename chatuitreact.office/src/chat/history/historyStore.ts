/* global indexedDB, IDBDatabase, IDBKeyRange, IDBRequest, IDBTransaction */

import type { InputItem } from "../api/types";
import type { SavedConversation } from "../conversation/conversation";

/**
 * Saved chats, kept in this browser's IndexedDB and never sent to the server. Each chat has a summary for the
 * history list, its items one record each, and the rest of its conversation.
 */

export interface SavedChatSummary {
  id: string;
  /** The document or email thread the chat belongs to (HostAdapter.getDocumentKey). */
  documentKey: string;
  /** The first user message, shortened. */
  title: string;
  /** Milliseconds since the epoch. */
  updatedAt: number;
}

export interface SavedChat extends SavedChatSummary {
  conversation: SavedConversation;
}

/** A conversation without its items. */
type ConversationRest = Omit<SavedConversation, "items">;

const DATABASE = "chatuit-history";
const VERSION = 2;
const SUMMARIES = "summaries";
const ITEMS = "items";
const RESTS = "conversations";
const BY_DOCUMENT = "documentKey";

let database: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      // Removes version 1's store of whole chats.
      if (db.objectStoreNames.contains("chats")) {
        db.deleteObjectStore("chats");
      }
      db.createObjectStore(SUMMARIES, { keyPath: "id" }).createIndex(BY_DOCUMENT, "documentKey");
      db.createObjectStore(ITEMS, { keyPath: ["chatId", "index"] });
      db.createObjectStore(RESTS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error: unknown) => {
    database = null;
    throw error;
  });
  return database;
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** The key range of one chat's items. */
function itemsOf(chatId: string): IDBKeyRange {
  return IDBKeyRange.bound([chatId, 0], [chatId, Infinity]);
}

/**
 * Saves a chat. Only items that are not the same objects as in `previous`, the items saved last time for this
 * chat, are written.
 */
export async function saveChat(chat: SavedChat, previous: readonly InputItem[] = []): Promise<void> {
  const db = await open();
  const transaction = db.transaction([SUMMARIES, ITEMS, RESTS], "readwrite");
  const { conversation, ...summary } = chat;
  const { items, ...rest } = conversation;
  transaction.objectStore(SUMMARIES).put(summary);
  transaction.objectStore(RESTS).put({ id: chat.id, ...rest });
  const itemStore = transaction.objectStore(ITEMS);
  items.forEach((item, index) => {
    if (previous[index] !== item) {
      itemStore.put({ chatId: chat.id, index, item });
    }
  });
  if (previous.length > items.length) {
    itemStore.delete(IDBKeyRange.bound([chat.id, items.length], [chat.id, Infinity]));
  }
  await done(transaction);
}

export async function loadChat(id: string): Promise<SavedChat | undefined> {
  const db = await open();
  const transaction = db.transaction([SUMMARIES, ITEMS, RESTS], "readonly");
  const [summary, rest, records] = await Promise.all([
    result<SavedChatSummary | undefined>(transaction.objectStore(SUMMARIES).get(id)),
    result<(ConversationRest & { id: string }) | undefined>(transaction.objectStore(RESTS).get(id)),
    result<Array<{ item: InputItem }>>(transaction.objectStore(ITEMS).getAll(itemsOf(id))),
  ]);
  if (!summary || !rest) {
    return undefined;
  }
  const { thoughts, activity, turns } = rest;
  return { ...summary, conversation: { items: records.map((record) => record.item), thoughts, activity, turns } };
}

/** The chats of one document, newest first. */
export async function listChats(documentKey: string): Promise<SavedChatSummary[]> {
  const db = await open();
  const index = db.transaction(SUMMARIES, "readonly").objectStore(SUMMARIES).index(BY_DOCUMENT);
  const summaries = await result<SavedChatSummary[]>(index.getAll(documentKey));
  return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
}
