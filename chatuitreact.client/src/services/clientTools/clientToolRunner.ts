import type { ActivityEntryDto } from "../../types/chatModels";
import { ApiError } from "../apiService";
import { respondToToolCall } from "../chatService";
import { getClientTool } from "./clientToolRegistry";

const inFlight = new Set<string>();

/**
 * Runs a client tool the server is waiting on and posts the result. Called by the chat store
 * once a flush leaves a call in status "awaitingClient". A tool this tab does not know is
 * left alone: another client type may own it, and the server's timeout covers the rest.
 */
export async function runClientToolCall(
  chatId: string,
  messageId: string,
  entry: ActivityEntryDto,
  timeoutMs: number,
): Promise<void> {
  const toolCallId = entry.toolCallId;
  const toolName = entry.toolName;
  if (!toolCallId || !toolName || inFlight.has(toolCallId)) {
    return;
  }

  const tool = getClientTool(toolName);
  if (!tool) {
    console.warn(`Client tool "${toolName}" was called but is not registered in this client`);
    return;
  }

  inFlight.add(toolCallId);
  let result: string;
  let isError = false;

  try {
    // A parse failure lands in the catch below and is reported to the model as the tool's error.
    const args: unknown = entry.argumentsJson && entry.argumentsJson.trim().length > 0
      ? JSON.parse(entry.argumentsJson)
      : {};

    const outcome = await tool.handler(args, {
      chatId,
      messageId,
      toolCallId,
      signal: AbortSignal.timeout(Math.max(1000, timeoutMs)),
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
    // 409 means the call is no longer pending (timed out, or another tab answered). Nothing to do.
    if (!(error instanceof ApiError && error.status === 409)) {
      console.error(`Failed to deliver client tool result for ${toolCallId}:`, error);
    }
  } finally {
    inFlight.delete(toolCallId);
  }
}
