import { signal, Signal, computed } from "@preact/signals-react";
import type { ChatDto, ChatFileDto, ChatHeaderDto, CreateChatDto } from "../types/chatModels";
import apiService from "./apiService";
import type { SendMessageDto } from "../types/chatModels";
import { getAssistants, getAssistant } from "./assistantService";
import type { AssistantDto } from "../types/assistantModels";
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
const chatNotFoundCache = new Map<string, Signal<boolean>>();

// Chunk throttling buffers
const chunkBuffers = new Map<string, string[]>();
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

export async function createChat(content: string, assistantId: string, files?: ChatFile[]): Promise<string> {
  try {
    const fileDtos = files ? mapToCreateChatFileDto(files) : undefined;
    const createChatDto: CreateChatDto = {
      assistantId,
      messages: [{
        content, 
        files: fileDtos,
        assistantId
      }]
    };

    ensurePayloadWithinLimit(createChatDto);

    const response = await apiService.post<ChatDto>("/api/Chats", createChatDto);
    return response.id;

  } catch (error) {
    console.error("Error creating chat:", error);
    throw error;
  }
}

export async function sendMessage(chatId: string, content: string, files?: ChatFile[]): Promise<void> {
  try {
    const assistantId = getCurrentAssistantId().value;
    if (!assistantId) {
      throw new Error("No assistant selected");
    }
    
    const fileDtos = files ? mapToCreateChatFileDto(files) : undefined;
    const messageDto: SendMessageDto = { 
      content,
      assistantId,
      files: fileDtos
    };

    ensurePayloadWithinLimit(messageDto);

    await apiService.post(`/api/Chats/${chatId}/messages`, messageDto);

  } catch (error) {
    console.error(`Error sending message to chat ${chatId}:`, error);
    throw error; // Re-throw to allow component to handle
  }
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


export async function invalidateChat(chatId: string): Promise<void> {
  try {
    // Get current chat
    const chatSignal = chatCache.get(chatId);
    const currentChat = chatSignal?.value;
    
    // Fetch fresh chat data
    const chat = await apiService<ChatDto>(`/api/Chats/${chatId}`);
    
    // Smart merge: preserve object references for unchanged messages to prevent unnecessary rerenders
    if (currentChat) {
      const mergedMessages = chat.messages.map(newMessage => {
        const existingMessage = currentChat.messages.find(m => m.id === newMessage.id);
        
        // If message exists and hasn't changed, keep the existing object reference
        if (existingMessage && 
            existingMessage.content === newMessage.content &&
            existingMessage.status === newMessage.status &&
            existingMessage.timestamp === newMessage.timestamp) {
          return existingMessage; // Preserve reference to avoid rerender
        }
        
        return newMessage; // New or changed message
      });
      
      chat.messages = mergedMessages;
      
      // Clean up stream caches for messages that are no longer generating
      currentChat.messages.forEach(oldMessage => {
        const newMessage = mergedMessages.find(m => m.id === oldMessage.id);
        if (oldMessage.status === "Generating" && newMessage && newMessage.status !== "Generating") {
          messageStreamCache.delete(oldMessage.id);
        }
      });
    }
    
    // Update chat signal
    if (chatSignal) {
      chatSignal.value = chat;
    } else {
      chatCache.set(chatId, signal(chat));
    }

    // clear any prior not-found flag
    const nf = chatNotFoundCache.get(chatId);
    if (nf) nf.value = false;
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : "";
    const status = (error as any)?.status;
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

export function getStreamSignal(messageId: string): Signal<string> {
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

function flushBuffer(messageId: string): void {
  const buffer = chunkBuffers.get(messageId);
  if (!buffer || buffer.length === 0) return;
  
  // Concatenate all buffered chunks
  const accumulated = buffer.join('');
  
  // Update stream signal
  let streamSignal = messageStreamCache.get(messageId);
  if (!streamSignal) {
    streamSignal = signal<string>("");
    messageStreamCache.set(messageId, streamSignal);
  }
  streamSignal.value += accumulated;
  
  // Clear buffer and timer
  chunkBuffers.delete(messageId);
  flushTimers.delete(messageId);
}

export function receiveMessageChunk(messageId: string, chunk: string): void {
  // Add chunk to buffer
  let buffer = chunkBuffers.get(messageId);
  if (!buffer) {
    buffer = [];
    chunkBuffers.set(messageId, buffer);
  }
  buffer.push(chunk);
  
  // Schedule flush if not already scheduled
  if (!flushTimers.has(messageId)) {
    const timer = setTimeout(() => flushBuffer(messageId), 250);
    flushTimers.set(messageId, timer);
  }
}

export function clearStreamCache(messageId?: string): void {
  if (messageId) {
    // Clear stream signal
    messageStreamCache.delete(messageId);
    
    // Clear any pending buffer and timer
    const timer = flushTimers.get(messageId);
    if (timer) {
      clearTimeout(timer);
      flushTimers.delete(messageId);
    }
    chunkBuffers.delete(messageId);
  } else {
    // Clear all stream signals
    messageStreamCache.clear();
    
    // Clear all pending timers and buffers
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

function getAutomaticAssistantId(): Signal<string | undefined> {
  return computed(() => {
    const chatId = currentChatIdSignal.value;
    
    if (chatId === "new") {
      const assistants = getAssistants().value;
      return assistants?.system[0]?.id;
    } else if (chatId) {
      const chats = chatListSignal.value;
      const chatHeader = chats?.find(c => c.id === chatId);
      return chatHeader?.assistantId || (getAssistants().value?.system[0]?.id);
    } else {
      const assistants = getAssistants().value;
      return assistants?.system[0]?.id;
    }
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
    
    // Always include default (system[0])
    const defaultAssistant = assistantList.system[0];
    
    // All visible assistants
    const visibleAssistants = [
      ...assistantList.owned.filter(a => a.isVisible),
      ...assistantList.system.filter(a => a.isVisible),
      ...assistantList.shared.filter(a => a.isVisible)
    ];
    
    // Include current assistant if it's not visible
    let hiddenCurrentAssistant = null;
    if (currentAssistantId) {
      const currentAssistant = getAssistant(currentAssistantId).value;
      if (currentAssistant && !currentAssistant.isVisible) {
        hiddenCurrentAssistant = currentAssistant;
      }
    }
    
    // Combine and deduplicate by ID
    const allAssistants = [defaultAssistant, ...visibleAssistants, hiddenCurrentAssistant].filter(Boolean) as AssistantDto[];
    return Array.from(new Map(allAssistants.map(a => [a.id, a])).values());
  });
}
