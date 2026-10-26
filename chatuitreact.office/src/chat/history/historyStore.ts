/* global indexedDB, IDBDatabase, IDBRequest, IDBTransactionMode, IDBObjectStore */

import type { SavedConversation } from "../conversation/conversation";

/** Saved chats, kept in this browser's IndexedDB and never sent to the server. */

export interface SavedChat {
  id: string;
  /** The document or email thread the chat belongs to (HostAdapter.getDocumentKey). */
  documentKey: string;
  /** The first user message, shortened. */
  title: string;
  /** Milliseconds since the epoch. */
  updatedAt: number;
  conversation: SavedConversation;
}

/** A saved chat without its conversation, for the history list. */
export type SavedChatSummary = Omit<SavedChat, "conversation">;

const DATABASE = "chatuit-history";
const STORE = "chats";
const BY_DOCUMENT = "documentKey";

let database: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex(BY_DOCUMENT, "documentKey");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).catch((error: unknown) => {
    database = null;
    throw error;
  });
  return database;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = action(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveChat(chat: SavedChat): Promise<void> {
  await run("readwrite", (store) => store.put(chat));
}

export function loadChat(id: string): Promise<SavedChat | undefined> {
  return run<SavedChat | undefined>("readonly", (store) => store.get(id));
}

/** The chats of one document, newest first. */
export async function listChats(documentKey: string): Promise<SavedChatSummary[]> {
  const chats = await run<SavedChat[]>("readonly", (store) => store.index(BY_DOCUMENT).getAll(documentKey));
  return chats
    .map(({ id, documentKey: key, title, updatedAt }) => ({ id, documentKey: key, title, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}
