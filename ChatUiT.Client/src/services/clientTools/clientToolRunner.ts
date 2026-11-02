import type { ActivityEntryDto, ChatDto, ToolPreviewDto } from "../../types/chatModels";
import { respondToToolCall } from "../chatService";
import { getClientTool } from "./clientToolRegistry";

const inFlight = new Set<string>();

/** The arguments of a call, parsed. Throws when they are not valid JSON. */
function parseArguments(entry: ActivityEntryDto): unknown {
  return entry.argumentsJson && entry.argumentsJson.trim().length > 0
    ? JSON.parse(entry.argumentsJson)
    : {};
}

/** Whether this client runs the tool the entry calls. */
export function isOwnClientTool(entry: ActivityEntryDto): boolean {
  return entry.toolName !== null && getClientTool(entry.toolName) !== undefined;
}

/** Whether the tool the entry calls asks the user before it runs. */
export function needsClientApproval(entry: ActivityEntryDto): boolean {
  return entry.toolName !== null && getClientTool(entry.toolName)?.preview !== undefined;
}

/** The preview the user approves before the call runs. Null when the tool has none or it fails. */
export async function previewClientToolCall(entry: ActivityEntryDto): Promise<ToolPreviewDto | null> {
  const tool = entry.toolName ? getClientTool(entry.toolName) : undefined;
  if (!tool?.preview) {
    return null;
  }

  try {
    return await tool.preview(parseArguments(entry));
  } catch (error) {
    console.error(`Preview of client tool "${entry.toolName}" failed:`, error);
    return null;
  }
}

/** Tells the server the user declined a call to a client tool. */
export async function declineClientToolCall(chatId: string, messageId: string, entry: ActivityEntryDto): Promise<void> {
  if (!entry.toolCallId) {
    return;
  }

  await respondToToolCall(chatId, messageId, entry.toolCallId, { kind: "clientResult", result: "", isError: false, decision: "reject" });
}

/**
 * Runs the calls to this client's own tools that a chat's messages wait on, except those that ask
 * the user first: the approval card runs those once approved.
 */
export function runWaitingClientCalls(chat: ChatDto): void {
  for (const message of chat.messages) {
    if (message.status !== "AwaitingUser") continue;
    for (const entry of message.activity?.entries ?? []) {
      if (entry.type === "Tool" && entry.status === "awaitingClient"
        && entry.response === null && isOwnClientTool(entry) && !needsClientApproval(entry)) {
        void runClientToolCall(chat.id, message.id, entry);
      }
    }
  }
}

/**
 * Runs a client tool a message waits on and posts the result. A tool this tab does not know is
 * left alone: another client type may own it. A call already running in this tab is not run again.
 */
export async function runClientToolCall(chatId: string, messageId: string, entry: ActivityEntryDto): Promise<void> {
  const toolCallId = entry.toolCallId;
  const tool = entry.toolName ? getClientTool(entry.toolName) : undefined;
  if (!toolCallId || !tool || inFlight.has(toolCallId)) {
    return;
  }

  inFlight.add(toolCallId);
  let result: string;
  let isError = false;

  try {
    // A parse failure lands in the catch below and is reported to the model as the tool's error.
    const outcome = await tool.handler(parseArguments(entry), {
      chatId,
      messageId,
      toolCallId,
      signal: new AbortController().signal,
    });

    if (typeof outcome === "string") {
      result = outcome;
    } else {
      result = outcome.result;
      isError = outcome.isError === true;
    }
  } catch (error) {
    result = error instanceof Error ? error.message : String(error);
    isError = true;
  }

  try {
    await respondToToolCall(chatId, messageId, toolCallId, { kind: "clientResult", result, isError });
  } catch (error) {
    console.error(`Failed to deliver client tool result for ${toolCallId}:`, error);
  } finally {
    inFlight.delete(toolCallId);
  }
}
