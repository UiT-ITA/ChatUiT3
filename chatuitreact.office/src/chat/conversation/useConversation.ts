import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { ResponsesClient } from "../api/client";
import type { ClientToolDefinition } from "../tools/types";
import { Conversation, type ConversationState, type ToolFailure } from "./conversation";

export interface ConversationHandle {
  state: ConversationState;
  conversation: Conversation;
}

/** Holds one in-memory conversation for the lifetime of the component. */
export function useConversation(
  client: ResponsesClient,
  model: string,
  instructions: string,
  tools: readonly ClientToolDefinition[],
  onToolError?: (failure: ToolFailure) => void,
  getContext?: () => Promise<string | null>
): ConversationHandle {
  const conversation = useMemo(
    () => new Conversation({ client, model, instructions, tools, onToolError, getContext }),
    [client, model, instructions, tools, onToolError, getContext]
  );
  const state = useSyncExternalStore(conversation.subscribe, conversation.getState);

  useEffect(() => () => conversation.cancel(), [conversation]);

  return { state, conversation };
}
