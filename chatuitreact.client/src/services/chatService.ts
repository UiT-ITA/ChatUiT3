import { signal, Signal, computed } from "@preact/signals-react";
import type { ChatDto, ChatFileDto, ChatHeaderDto, ChatMessageDto, ChatStreamChunk, CreateChatDto, MessageActivityDto, ActivityEntryDto, UpdateChatDto, ToolCallResponseDto, ToolCallResponseResultDto, ToolCallStatus } from "../types/chatModels";
import { getClientToolDeclarations } from "./clientTools/clientToolRegistry";
import { runClientToolCall } from "./clientTools/clientToolRunner";
import apiService, { ApiError } from "./apiService";
import type { SendMessageDto } from "../types/chatModels";
import { getAssistants, getAssistant } from "./assistantService";
import { getAppDefaults } from "./appSettingsService";
import type { AssistantDto, AssistantSummaryDto, FullAssistantDto } from "../types/assistantModels";
import type { ChatFile } from "../types/fileModels";
import { formatFileSize, mapToCreateChatFileDto } from "../utils/fileUtils";
import { addNotification } from "./notificationService";

// Must stay below the server's Kestrel MaxRequestBodySize (100 MB); the margin
// covers headers and JSON overhead.
const MAX_MESSAGE_PAYLOAD_BYTES = 95 * 1024 * 1024;

function ensurePayloadWithinLimit(payload: unknown): void {
  const size = new Blob([JSON.stringify(payload)]).size;
  if (size > MAX_MESSAGE_PAYLOAD_BYTES) {
    const message = `Message is too large to send (${formatFileSize(size)}). The limit is ${formatFileSize(MAX_MESSAGE_PAYLOAD_BYTES)} — remove some files or use smaller ones.`;
    addNotification({ level: "Error", message });
    throw new Error(message);
  }
}

const chatListSignal = signal<ChatHeaderDto[] | undefined>(undefined);
const currentChatIdSignal = signal<string | undefined>(undefined);
const userSelectedAssistantIdSignal = signal<string | undefined>(undefined);

const chatCache = new Map<string, Signal<ChatDto | undefined>>();
const messageStreamCache = new Map<string, Signal<string>>();
const messageActivityCache = new Map<string, Signal<LiveActivity>>();
// Which chat a streaming message belongs to; needed to answer its tool calls.
const messageChatIds = new Map<string, string>();
const chatNotFoundCache = new Map<string, Signal<boolean>>();

const OPTIMISTIC_USER_MESSAGE_ID = "optimistic-user";
const OPTIMISTIC_REPLY_ID = "optimistic-reply";

// Chunk throttling buffers
const chunkBuffers = new Map<string, ChatStreamChunk[]>();
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

let chatListLoadingPromise: Promise<void> | null = null;
let streamMessageCallback: ((messageId: string) => void) | null = null;

export function setStreamMessageCallback(callback: (messageId: string) => void): void {
    streamMessageCallback = callback;
}

export function getChats(): Signal<ChatHeaderDto[] | undefined> {
  if (chatListSignal.value === undefined && !chatListLoadingPromise) {
    invalidateChats();
  }
  return chatListSignal;
}

export async function invalidateChats(): Promise<void> {
  if (chatListLoadingPromise) {
    return chatListLoadingPromise;
  }

  chatListLoadingPromise = (async () => {
    try {
      const chats = await apiService<ChatHeaderDto[]>("/api/Chats");
      chatListSignal.value = chats;
    } catch (error) {
      console.error("Error invalidating chats:", error);
    } finally {
      chatListLoadingPromise = null;
    }
  })();

  return chatListLoadingPromise;
}

async function createChat(assistantId: string): Promise<ChatDto> {
  const createChatDto: CreateChatDto = { assistantId };
  return apiService.post<ChatDto>("/api/Chats", createChatDto);
}

function buildOptimisticMessages(content: string, files: ChatFile[], assistantId: string): ChatMessageDto[] {
  const timestamp = new Date().toISOString();

  return [
    {
      id: OPTIMISTIC_USER_MESSAGE_ID,
      role: "User",
      timestamp,
      content,
      status: "Success",
      files,
      assistantId: "",
      assistantName: "",
      tokenCounts: {},
      fileTokenCounts: {},
      optimistic: true
    },
    {
      id: OPTIMISTIC_REPLY_ID,
      role: "Assistant",
      timestamp,
      content: "",
      status: "Generating",
      files: [],
      assistantId,
      assistantName: getAssistant(assistantId).peek()?.name ?? "",
      tokenCounts: {},
      fileTokenCounts: {},
      optimistic: true
    }
  ];
}

function removeOptimisticMessages(chatId: string): void {
  const chatSignal = chatCache.get(chatId);
  if (chatSignal?.value) {
    chatSignal.value = { ...chatSignal.value, messages: chatSignal.value.messages.filter(m => !m.optimistic) };
  }
}

export async function sendNewChatMessage(
  content: string,
  files: ChatFile[],
  assistantId: string,
  onCreated: (chatId: string) => void
): Promise<void> {
  const created = await createChat(assistantId);

  chatCache.set(created.id, signal<ChatDto | undefined>({
    ...created,
    messages: buildOptimisticMessages(content, files, assistantId)
  }));
  onCreated(created.id);

  await postMessage(created.id, content, files, assistantId);
}

// The server broadcasts ChatListUpdated after each of these, which refetches the list.
// The local signal writes below only exist so the UI does not lag a round-trip.

export async function renameChat(chatId: string, name: string): Promise<void> {
  const trimmed = name.trim();

  try {
    const update: UpdateChatDto = { name: trimmed };
    await apiService(`/api/Chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });

    chatListSignal.value = chatListSignal.value?.map(chat =>
      chat.id === chatId ? { ...chat, name: trimmed } : chat
    );

    // The main header reads the name off the full chat, not the list header.
    const chatSignal = chatCache.get(chatId);
    if (chatSignal?.value) {
      chatSignal.value = { ...chatSignal.value, name: trimmed };
    }
  } catch (error) {
    console.error(`Error renaming chat ${chatId}:`, error);
    throw error;
  }
}

export async function setChatFavorite(chatId: string, isFavorite: boolean): Promise<void> {
  try {
    const update: UpdateChatDto = { isFavorite };
    await apiService(`/api/Chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });

    chatListSignal.value = chatListSignal.value?.map(chat =>
      chat.id === chatId ? { ...chat, isFavorite } : chat
    );

    const chatSignal = chatCache.get(chatId);
    if (chatSignal?.value) {
      chatSignal.value = { ...chatSignal.value, isFavorite };
    }
  } catch (error) {
    console.error(`Error updating favorite for chat ${chatId}:`, error);
    throw error;
  }
}

// Drops every local trace of a chat that no longer exists on the server.
function purgeChatCaches(chatId: string): void {
  chatListSignal.value = chatListSignal.value?.filter(chat => chat.id !== chatId);

  chatCache.delete(chatId);
  chatNotFoundCache.delete(chatId);
  for (const key of Array.from(fileContentCache.keys())) {
    if (key.startsWith(`${chatId}/`)) {
      fileContentCache.delete(key);
    }
  }
}

export async function deleteChat(chatId: string): Promise<void> {
  try {
    await apiService(`/api/Chats/${chatId}`, { method: 'DELETE' });

    purgeChatCaches(chatId);
  } catch (error) {
    console.error(`Error deleting chat ${chatId}:`, error);
    throw error;
  }
}

export async function sendMessage(chatId: string, content: string, files: ChatFile[]): Promise<void> {
  const assistantId = getCurrentAssistantId().value;
  if (!assistantId) {
    throw new Error("No assistant selected");
  }

  const chatSignal = getChat(chatId);
  if (chatSignal.value) {
    chatSignal.value = {
      ...chatSignal.value,
      messages: [...chatSignal.value.messages, ...buildOptimisticMessages(content, files, assistantId)]
    };
  }

  try {
    await postMessage(chatId, content, files, assistantId);
  } catch (error) {
    removeOptimisticMessages(chatId);
    throw error;
  }
}

async function postMessage(chatId: string, content: string, files: ChatFile[], assistantId: string): Promise<void> {
  // Lets the optimistic messages paint before the request is serialized, which is slow with large files.
  await new Promise(resolve => setTimeout(resolve, 0));

  const messageDto: SendMessageDto = {
    content,
    assistantId,
    files: mapToCreateChatFileDto(files),
    clientTools: getClientToolDeclarations()
  };

  ensurePayloadWithinLimit(messageDto);

  await apiService.post(`/api/Chats/${chatId}/messages`, messageDto);
}

/**
 * Stops a running generation. The server undoes the whole send — both the assistant message
 * and the user message that triggered it are deleted, and the chat too if it is left empty —
 * so the caller is responsible for putting the text back in the composer.
 *
 * Returns false when the generation had already finished: nothing was undone, leave the chat alone.
 */
export async function cancelGeneration(chatId: string, messageId: string): Promise<boolean> {
  try {
    const response = await apiService.post<{ cancelled: boolean }>(
      `/api/Chats/${chatId}/messages/${messageId}/cancel`,
      {}
    );
    return response?.cancelled === true;
  } catch (error) {
    console.error(`Error cancelling generation for message ${messageId}:`, error);
    throw error;
  }
}

// The chat is gone server-side once its last exchange is cancelled away; drop it locally too
// instead of waiting for a refetch that would 404.
export function forgetChat(chatId: string): void {
  purgeChatCaches(chatId);
}

// Chat file content is loaded on demand (the chat DTO only carries file metadata).
const fileContentCache = new Map<string, Promise<ChatFileDto>>();

export function fetchChatFile(chatId: string, fileId: string): Promise<ChatFileDto> {
  const cacheKey = `${chatId}/${fileId}`;
  let pending = fileContentCache.get(cacheKey);

  if (!pending) {
    pending = apiService<ChatFileDto>(`/api/Chats/${chatId}/files/${fileId}`);
    fileContentCache.set(cacheKey, pending);
    pending.catch(() => fileContentCache.delete(cacheKey));
  }

  return pending;
}

export function getChat(chatId: string): Signal<ChatDto | undefined> {
  let chatSignal = chatCache.get(chatId);

  if (!chatSignal) {
    chatSignal = signal<ChatDto | undefined>(undefined);
    chatCache.set(chatId, chatSignal);

    invalidateChat(chatId);
  }

  return chatSignal;
}


// Counts can arrive after the message itself (a backfill on a later read), so the merge
// compares them and must not treat a newly counted message as unchanged.
function sameTokenCounts(a: Record<string, number> | undefined, b: Record<string, number> | undefined): boolean {
  const aKeys = Object.keys(a ?? {});
  const bKeys = Object.keys(b ?? {});
  return aKeys.length === bKeys.length && aKeys.every(key => a![key] === b?.[key]);
}

export async function invalidateChat(chatId: string): Promise<void> {
  try {
    const chatSignal = chatCache.get(chatId);
    const currentChat = chatSignal?.value;
    
    const chat = await apiService<ChatDto>(`/api/Chats/${chatId}`);
    
    // Smart merge: preserve object references for unchanged messages to prevent unnecessary rerenders
    if (currentChat) {
      const mergedMessages = chat.messages.map(newMessage => {
        const existingMessage = currentChat.messages.find(m => m.id === newMessage.id);
        
        if (existingMessage && 
            existingMessage.content === newMessage.content &&
            existingMessage.status === newMessage.status &&
            existingMessage.timestamp === newMessage.timestamp &&
            existingMessage.assistantName === newMessage.assistantName &&
            sameTokenCounts(existingMessage.tokenCounts, newMessage.tokenCounts)) {
          return existingMessage;
        }
        
        return newMessage;
      });
      
      chat.messages = mergedMessages;
      
      // Clean up stream caches for messages that are no longer generating — including
      // messages that vanished entirely, which is what a cancelled generation leaves behind.
      currentChat.messages.forEach(oldMessage => {
        const newMessage = mergedMessages.find(m => m.id === oldMessage.id);
        if (oldMessage.status === "Generating" && (!newMessage || newMessage.status !== "Generating")) {
          messageStreamCache.delete(oldMessage.id);
          messageActivityCache.delete(oldMessage.id);
          messageChatIds.delete(oldMessage.id);
        }
      });
    }
    
    const optimisticMessages = chatSignal?.value?.messages.filter(m => m.optimistic) ?? [];
    const messagesBeforeSend = (chatSignal?.value?.messages.length ?? 0) - optimisticMessages.length;
    if (optimisticMessages.length > 0 && chat.messages.length <= messagesBeforeSend) {
      chat.messages = [...chat.messages, ...optimisticMessages];
    }

    if (chatSignal) {
      chatSignal.value = chat;
    } else {
      chatCache.set(chatId, signal(chat));
    }

    // clear any prior not-found flag
    const nf = chatNotFoundCache.get(chatId);
    if (nf) nf.value = false;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    const status = error instanceof ApiError ? error.status : undefined;
    const is404 = status === 404 || msg.startsWith("API call failed: 404");
    if (!is404) {
      console.error(`Error invalidating chat ${chatId}:`, error);
    }
    let nf = chatNotFoundCache.get(chatId);
    if (!nf) {
      nf = signal<boolean>(false);
      chatNotFoundCache.set(chatId, nf);
    }
    nf.value = !!is404;

    if (!chatCache.get(chatId)) {
      chatCache.set(chatId, signal<ChatDto | undefined>(undefined));
    }
  }
}

export function getStreamSignal(messageId: string, chatId?: string): Signal<string> {
  if (chatId) messageChatIds.set(messageId, chatId);
  let streamSignal = messageStreamCache.get(messageId);
  
  if (!streamSignal) {
    streamSignal = signal<string>("");
    messageStreamCache.set(messageId, streamSignal);

    if (streamMessageCallback) {
      streamMessageCallback(messageId);
    }
  }
  
  return streamSignal;
}

/** What the message's generation is doing right now. "awaitingUser" means a tool call needs the user's answer. */
export type GenerationPhase = "starting" | "thinking" | "tool" | "awaitingUser" | "writing" | "done";

/**
 * The activity of a message as it streams in, rebuilt chunk by chunk. `final` is set once the
 * server sends its summary; until then the totals are derived from the entries.
 */
export interface LiveActivity {
  entries: ActivityEntryDto[];
  phase: GenerationPhase;
  /** Server-side time when the current phase began, ms since generation start. */
  phaseStartedMs: number;
  /** Server-side time of the latest chunk, ms since generation start. */
  lastElapsedMs: number;
  /** Local clock (Date.now) when the latest chunk was applied; lets the UI count on between chunks. */
  receivedAt: number;
  /** True once any message text has arrived. */
  hasText: boolean;
  final: MessageActivityDto | null;
  /** The chat this message belongs to, once known. */
  chatId: string | null;
  /** The tool call the run is paused on, if any. */
  pendingToolCallId: string | null;
  /** Server time (ms since generation start) when the pending call times out. */
  pendingDeadlineMs: number | null;
}

const EMPTY_ACTIVITY: LiveActivity = {
  entries: [],
  phase: "starting",
  phaseStartedMs: 0,
  lastElapsedMs: 0,
  receivedAt: 0,
  hasText: false,
  final: null,
  chatId: null,
  pendingToolCallId: null,
  pendingDeadlineMs: null,
};

export function getActivitySignal(messageId: string, chatId?: string): Signal<LiveActivity> {
  if (chatId) messageChatIds.set(messageId, chatId);
  let activitySignal = messageActivityCache.get(messageId);
  if (!activitySignal) {
    // Anchored to now so the counter ticks from when the message appeared until the first
    // chunk brings the server's own timing.
    activitySignal = signal<LiveActivity>({ ...EMPTY_ACTIVITY, receivedAt: Date.now() });
    messageActivityCache.set(messageId, activitySignal);
  }
  return activitySignal;
}

function applyChunk(activity: LiveActivity, chunk: ChatStreamChunk): LiveActivity {
  const entries = activity.entries;
  const last = entries[entries.length - 1];
  const base = { ...activity, lastElapsedMs: chunk.elapsedMs, receivedAt: Date.now() };

  // Updates the tool entry the chunk refers to; entries are immutable so the signal changes.
  const updateTool = (patch: Partial<ActivityEntryDto>): ActivityEntryDto[] =>
    entries.map(entry =>
      entry.type === "Tool" && entry.toolCallId === chunk.toolCallId && entry.endedMs === null
        ? { ...entry, ...patch }
        : entry);

  const clearPending = base.pendingToolCallId === chunk.toolCallId
    ? { pendingToolCallId: null, pendingDeadlineMs: null }
    : {};

  switch (chunk.kind) {
    case "Text":
      return base.phase === "writing"
        ? { ...base, hasText: true }
        : { ...base, hasText: true, phase: "writing", phaseStartedMs: chunk.elapsedMs };
    case "Thinking": {
      const delta = chunk.text ?? "";
      if (base.phase === "thinking" && last && last.type === "Thinking" && last.endedMs === null) {
        const updated: ActivityEntryDto = { ...last, text: (last.text ?? "") + delta };
        return { ...base, entries: [...entries.slice(0, -1), updated] };
      }
      const entry: ActivityEntryDto = {
        type: "Thinking",
        startedMs: chunk.elapsedMs,
        endedMs: null,
        text: delta,
        toolCallId: null,
        toolName: null,
        argumentsJson: null,
        result: null,
        isError: false,
        execution: "server",
        status: "running",
        preview: null,
        requiredScopes: [],
      };
      return { ...base, entries: [...closeOpenEntries(entries, chunk.elapsedMs), entry], phase: "thinking", phaseStartedMs: chunk.elapsedMs };
    }
    case "ToolStart": {
      const entry: ActivityEntryDto = {
        type: "Tool",
        startedMs: chunk.elapsedMs,
        endedMs: null,
        text: null,
        toolCallId: chunk.toolCallId,
        toolName: chunk.toolName,
        argumentsJson: chunk.argumentsJson,
        result: null,
        isError: false,
        execution: chunk.execution ?? "server",
        status: "running",
        preview: null,
        requiredScopes: [],
      };
      return { ...base, entries: [...closeOpenEntries(entries, chunk.elapsedMs), entry], phase: "tool", phaseStartedMs: chunk.elapsedMs };
    }
    case "ToolConfirmationRequested":
      return {
        ...base,
        entries: updateTool({ status: "awaitingConfirmation", preview: chunk.preview, argumentsJson: chunk.argumentsJson ?? undefined }),
        phase: "awaitingUser",
        phaseStartedMs: chunk.elapsedMs,
        pendingToolCallId: chunk.toolCallId,
        pendingDeadlineMs: chunk.timeoutMs !== null ? chunk.elapsedMs + chunk.timeoutMs : null,
      };
    case "ToolConsentRequired":
      return {
        ...base,
        entries: updateTool({ status: "awaitingConsent", requiredScopes: chunk.requiredScopes ?? [] }),
        phase: "awaitingUser",
        phaseStartedMs: chunk.elapsedMs,
        pendingToolCallId: chunk.toolCallId,
        pendingDeadlineMs: chunk.timeoutMs !== null ? chunk.elapsedMs + chunk.timeoutMs : null,
      };
    case "ToolClientCallRequested":
      // The client's job, not the user's: the phase stays "tool".
      return {
        ...base,
        entries: updateTool({ status: "awaitingClient", argumentsJson: chunk.argumentsJson ?? undefined }),
        pendingToolCallId: chunk.toolCallId,
        pendingDeadlineMs: chunk.timeoutMs !== null ? chunk.elapsedMs + chunk.timeoutMs : null,
      };
    case "ToolStatus": {
      const status = chunk.status ?? "running";
      const resumed = base.phase === "awaitingUser" && (status === "approved" || status === "running");
      return {
        ...base,
        entries: updateTool({ status, argumentsJson: chunk.argumentsJson ?? undefined }),
        ...(resumed ? { phase: "tool" as GenerationPhase, phaseStartedMs: chunk.elapsedMs, ...clearPending } : {}),
      };
    }
    case "ToolEnd":
      return {
        ...base,
        entries: updateTool({
          endedMs: chunk.elapsedMs,
          result: chunk.result,
          isError: chunk.isError,
          status: chunk.status ?? (chunk.isError ? "error" : "completed"),
        }),
        ...(base.phase === "awaitingUser" ? { phase: "tool" as GenerationPhase, phaseStartedMs: chunk.elapsedMs } : {}),
        ...clearPending,
      };
    case "Done":
      return {
        ...base,
        entries: chunk.activity?.entries ?? closeOpenEntries(entries, chunk.elapsedMs),
        phase: "done",
        phaseStartedMs: chunk.elapsedMs,
        final: chunk.activity,
        pendingToolCallId: null,
        pendingDeadlineMs: null,
      };
    default: {
      // An unknown kind from a newer server must not corrupt the activity; ignore it.
      const _exhaustive: never = chunk.kind;
      void _exhaustive;
      return base;
    }
  }
}

function closeOpenEntries(entries: ActivityEntryDto[], endedMs: number): ActivityEntryDto[] {
  return entries.map(entry => (entry.endedMs === null ? { ...entry, endedMs } : entry));
}

function flushBuffer(messageId: string): void {
  const buffer = chunkBuffers.get(messageId);
  if (!buffer || buffer.length === 0) return;

  let text = "";
  let activity = getActivitySignal(messageId).value;
  const clientCalls = new Map<string, number>();
  for (const chunk of buffer) {
    if (chunk.kind === "Text") {
      text += chunk.text ?? "";
    }
    if (chunk.kind === "ToolClientCallRequested" && chunk.toolCallId) {
      clientCalls.set(chunk.toolCallId, chunk.timeoutMs ?? 60_000);
    }
    activity = applyChunk(activity, chunk);
  }
  const chatId = messageChatIds.get(messageId) ?? activity.chatId;
  activity = { ...activity, chatId: chatId ?? null };

  // One signal write per flush, so a burst of chunks costs one render. The signal is created
  // directly rather than through getStreamSignal: a chunk means the hub stream is already
  // subscribed, and subscribing again would replay it.
  if (text.length > 0) {
    let streamSignal = messageStreamCache.get(messageId);
    if (!streamSignal) {
      streamSignal = signal<string>("");
      messageStreamCache.set(messageId, streamSignal);
    }
    streamSignal.value += text;
  }
  getActivitySignal(messageId).value = activity;

  chunkBuffers.delete(messageId);
  flushTimers.delete(messageId);

  // Only calls still waiting after the whole buffer is applied are run. A replayed stream
  // delivers the call and its end in one burst, so a finished call is never run twice.
  if (chatId && clientCalls.size > 0) {
    for (const entry of activity.entries) {
      if (entry.type === "Tool" && entry.status === "awaitingClient" && entry.toolCallId && clientCalls.has(entry.toolCallId)) {
        void runClientToolCall(chatId, messageId, entry, clientCalls.get(entry.toolCallId)!);
      }
    }
  }
}

/**
 * Answers a tool call the run is paused on. The entry's status is set right away so the card
 * does not flicker while the server's ToolStatus chunk travels. A 409 means the call was
 * already answered elsewhere or timed out; the returned status is adopted and no error is
 * raised.
 */
export async function respondToToolCall(
  chatId: string,
  messageId: string,
  toolCallId: string,
  body: ToolCallResponseDto,
): Promise<ToolCallResponseResultDto> {
  const endpoint = `/api/Chats/${chatId}/messages/${messageId}/tool-calls/${toolCallId}/respond`;
  try {
    const result = await apiService.post<ToolCallResponseResultDto>(endpoint, body);
    if (result?.status) {
      setLiveToolStatus(messageId, toolCallId, result.status);
    }
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const stale: ToolCallResponseResultDto = { accepted: false, status: null };
      return stale;
    }
    throw error;
  }
}

function setLiveToolStatus(messageId: string, toolCallId: string, status: ToolCallStatus): void {
  const activitySignal = messageActivityCache.get(messageId);
  if (!activitySignal) return;
  const current = activitySignal.value;
  const resumed = status === "approved" || status === "running";
  activitySignal.value = {
    ...current,
    entries: current.entries.map(entry =>
      entry.type === "Tool" && entry.toolCallId === toolCallId && entry.endedMs === null ? { ...entry, status } : entry),
    ...(resumed && current.phase === "awaitingUser" ? { phase: "tool" as GenerationPhase, pendingToolCallId: null, pendingDeadlineMs: null } : {}),
  };
}

export function receiveMessageChunk(messageId: string, chunk: ChatStreamChunk): void {
  let buffer = chunkBuffers.get(messageId);
  if (!buffer) {
    buffer = [];
    chunkBuffers.set(messageId, buffer);
  }
  buffer.push(chunk);
  
  if (!flushTimers.has(messageId)) {
    const timer = setTimeout(() => flushBuffer(messageId), 250);
    flushTimers.set(messageId, timer);
  }
}

export function clearStreamCache(messageId?: string): void {
  if (messageId) {
    messageStreamCache.delete(messageId);
    messageActivityCache.delete(messageId);
    messageChatIds.delete(messageId);
    
    const timer = flushTimers.get(messageId);
    if (timer) {
      clearTimeout(timer);
      flushTimers.delete(messageId);
    }
    chunkBuffers.delete(messageId);
  } else {
    messageStreamCache.clear();
    messageActivityCache.clear();
    messageChatIds.clear();
    
    flushTimers.forEach(timer => clearTimeout(timer));
    flushTimers.clear();
    chunkBuffers.clear();
  }
}

export function getChatNotFound(chatId: string): Signal<boolean> {
  let nf = chatNotFoundCache.get(chatId);
  if (!nf) {
    nf = signal<boolean>(false);
    chatNotFoundCache.set(chatId, nf);
  }
  return nf;
}

export function getStreamCacheInfo(): { size: number; messageIds: string[] } {
  return {
    size: messageStreamCache.size,
    messageIds: Array.from(messageStreamCache.keys())
  };
}

export function getCurrentChatId(): Signal<string | undefined> {
  return currentChatIdSignal;
}

export function setCurrentChatId(chatId: string | undefined): void {
  currentChatIdSignal.value = chatId;
  userSelectedAssistantIdSignal.value = undefined;
}

/**
 * Where a new chat starts, in order: the assistant this user pinned, the org-wide default an
 * admin chose, then the first system assistant as a last resort.
 *
 * A pin is re-checked here on every read rather than being cleared when it stops being usable,
 * so switching a pinned assistant's model to one that is not default-eligible makes the pin
 * inactive, and switching it back makes it work again. Visibility is deliberately not part of
 * this: hiding an assistant from the selector must not silently unset the pin.
 */
function getResolvedDefaultAssistantId(): Signal<string | undefined> {
  return computed(() => {
    const assistantList = getAssistants().value;
    if (!assistantList) return undefined;

    const all = [...assistantList.owned, ...assistantList.system, ...assistantList.shared];

    const pinned = assistantList.defaultAssistantId
      ? all.find(a => a.id === assistantList.defaultAssistantId)
      : undefined;
    if (pinned?.canBeDefault) return pinned.id;

    const orgDefaultId = getAppDefaults().value?.defaultAssistantId;
    const orgDefault = orgDefaultId ? all.find(a => a.id === orgDefaultId) : undefined;
    if (orgDefault) return orgDefault.id;

    return assistantList.system[0]?.id;
  });
}

function getAutomaticAssistantId(): Signal<string | undefined> {
  return computed(() => {
    const chatId = currentChatIdSignal.value;

    // An existing chat keeps the assistant it was created with.
    if (chatId && chatId !== "new") {
      const chats = chatListSignal.value;
      const chatHeader = chats?.find(c => c.id === chatId);
      if (chatHeader?.assistantId) return chatHeader.assistantId;
    }

    return getResolvedDefaultAssistantId().value;
  });
}

export function getCurrentAssistantId(): Signal<string | undefined> {
  return computed(() => {
    return userSelectedAssistantIdSignal.value || getAutomaticAssistantId().value;
  });
}

export function setUserSelectedAssistantId(assistantId: string): void {
  userSelectedAssistantIdSignal.value = assistantId;
}

export function clearUserSelectedAssistantId(): void {
  userSelectedAssistantIdSignal.value = undefined;
}

export function getSelectableAssistants(): Signal<AssistantDto[]> {
  return computed(() => {
    const assistantList = getAssistants().value;
    const currentAssistantId = getCurrentAssistantId().value;

    if (!assistantList) return [];

    // The wire format carries the category as the bucket an assistant sits in;
    // tag each one so consumers can still tell owned/system/shared apart after
    // the buckets are flattened.
    const tag = (
      assistants: (FullAssistantDto | AssistantSummaryDto)[],
      type: AssistantDto['type']
    ): AssistantDto[] => assistants.map(a => ({ ...a, type } as AssistantDto));

    // Always include whichever assistant a new chat actually starts on, so it can never be
    // missing from the picker. getAssistant resolves the category for us.
    const resolvedDefaultId = getResolvedDefaultAssistantId().value;
    const defaultAssistant = resolvedDefaultId ? getAssistant(resolvedDefaultId).value : undefined;

    const visibleAssistants = [
      ...tag(assistantList.owned.filter(a => a.isVisible), 'owned'),
      ...tag(assistantList.system.filter(a => a.isVisible), 'system'),
      ...tag(assistantList.shared.filter(a => a.isVisible), 'shared')
    ];

    let hiddenCurrentAssistant = null;
    if (currentAssistantId) {
      const currentAssistant = getAssistant(currentAssistantId).value;
      if (currentAssistant && !currentAssistant.isVisible) {
        hiddenCurrentAssistant = currentAssistant;
      }
    }

    const allAssistants = [defaultAssistant, ...visibleAssistants, hiddenCurrentAssistant].filter(Boolean) as AssistantDto[];
    return Array.from(new Map(allAssistants.map(a => [a.id, a])).values());
  });
}
