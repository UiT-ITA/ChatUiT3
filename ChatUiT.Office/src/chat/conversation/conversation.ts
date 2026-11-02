/* global AbortController, AbortSignal */

import type { ResponsesClient } from "../api/client";
import type {
  ApprovalAnswer,
  ApprovalPreview,
  CreateResponseRequest,
  FilePart,
  FunctionCallItem,
  FunctionCallOutputItem,
  InputItem,
  McpApprovalRequestItem,
  McpApprovalResponseItem,
  McpCallItem,
  OutputItem,
  StreamEvent,
  TextPart,
} from "../api/types";
import type { ChatFile } from "../files/fileModels";
import { toFilePart } from "../files/filePart";
import { ToolResultWithImages, type ClientToolDefinition, type ToolArguments } from "../tools/types";

export type ConversationStatus = "idle" | "streaming" | "running_tools" | "awaiting_approval";

/** A step shown under a reasoning item or an mcp_call: an inner call by name, or a summary part. */
export type ActivityEntry = { kind: "call"; name: string } | { kind: "summary"; index: number };

/** Display-only progress of a reasoning item or an mcp_call. It is never sent in `input`. */
export interface ItemActivity {
  /** Inner calls and reasoning summary parts, in the order they arrived. */
  entries: readonly ActivityEntry[];
  /** Reasoning summary text by summary index. */
  summaries: readonly string[];
  /** True when the item has finished, so its summary is shown collapsed. */
  done: boolean;
}

/** A reasoning item of an earlier response, shown before `items[position]`. */
export interface Thought {
  position: number;
  id: string;
}

/**
 * One user message and every request the loop sent for it, until nothing was pending.
 * A turn waiting for an approval is still open.
 */
export interface Turn {
  /** Index in `items` of the user message that started the turn. */
  start: number;
  /** Milliseconds since the epoch. */
  startedAt: number;
  /** Null while the turn runs or waits for an approval. */
  endedAt: number | null;
}

export interface ConversationState {
  /** The full item history. It is sent as `input` on every request. */
  items: readonly InputItem[];
  /** Output items of the response that is streaming now, by output index. */
  live: readonly OutputItem[];
  status: ConversationStatus;
  /** The client function call that is executing now. */
  runningCallId: string | null;
  error: string | null;
  /** True when the last run was stopped by the user. */
  cancelled: boolean;
  /** Reasoning summaries and inner calls, by reasoning item id or mcp_call item id. */
  activity: Readonly<Record<string, ItemActivity>>;
  /** Reasoning items to show in the history, including those not kept in `items`. */
  thoughts: readonly Thought[];
  turns: readonly Turn[];
  /**
   * The previews of the add-in's own function calls that wait for the user's approval, by call id.
   * Built again from the call's arguments when a saved conversation is loaded.
   */
  previews: Readonly<Record<string, ApprovalPreview>>;
}

/** The part of a conversation that is saved, and restored by `Conversation.load`. */
export type SavedConversation = Pick<ConversationState, "items" | "thoughts" | "activity" | "turns">;

/**
 * A confirmation is approved or not. Questions are answered with `answers`, one per question and null for a
 * skipped one, or not answered with `approve` false.
 */
export interface ApprovalDecision {
  approve: boolean;
  /** A JSON object string. Only for confirmation requests whose preview has `allow_edit`. */
  editedArguments?: string;
  answers?: (ApprovalAnswer | null)[];
}

export type ApprovalState = "pending" | "approved" | "rejected" | "unanswered";

/** Answers the user filled in for a question request, sent with a new message instead of on their own. */
export interface PendingAnswer {
  requestId: string;
  /** One per question, null for a question left empty. */
  answers: (ApprovalAnswer | null)[];
}

export interface ConversationOptions {
  client: ResponsesClient;
  model: string;
  /** The app's own rules, which the server appends to the model's system prompt. */
  instructions?: string;
  tools: readonly ClientToolDefinition[];
  /** The clock for turn durations. Defaults to `Date.now`. */
  now?: () => number;
  /** Called for every tool call that fails, except calls the user cancelled. */
  onToolError?: (failure: ToolFailure) => void;
  /** What the user is looking at in the app right now. Sent after the user's text, with the newest message only. */
  getContext?: () => Promise<string | null>;
}

/** Starts the text part that carries the app's context, so the chat can leave it out of the user's message. */
export const CONTEXT_PREFIX = "[App context] ";

/** A user message without the app's context part. Other items are returned as they are. */
function withoutContext(item: InputItem): InputItem {
  if (item.type !== "message" || item.role !== "user" || typeof item.content === "string") {
    return item;
  }
  const content = item.content.filter((part) => !(part.type === "input_text" && part.text.startsWith(CONTEXT_PREFIX)));
  return content.length === item.content.length ? item : { ...item, content };
}

/** A user message: the user's text, then the attached files, then the app's context. */
function userMessage(text: string, files: readonly FilePart[], context: string | null): InputItem {
  const parts: Array<TextPart | FilePart> = [
    ...(text ? [{ type: "input_text" as const, text }] : []),
    ...files,
    ...(context ? [{ type: "input_text" as const, text: CONTEXT_PREFIX + context }] : []),
  ];
  return {
    type: "message",
    role: "user",
    content: parts.length === 1 && parts[0].type === "input_text" ? parts[0].text : parts,
  };
}

/** A tool call that failed: the tool, the arguments as the model sent them, and the error. */
export interface ToolFailure {
  name: string;
  arguments: string;
  error: string;
}

const initialState: ConversationState = {
  items: [],
  live: [],
  status: "idle",
  runningCallId: null,
  error: null,
  cancelled: false,
  activity: {},
  thoughts: [],
  turns: [],
  previews: {},
};

/** What a call the user declined gets. */
const DECLINED = "The user declined this action. Do not retry it.";

/**
 * One conversation with a ChatUiT model, held in memory.
 *
 * The loop: stream a response, append its output, run the client function calls and append
 * their outputs, stop while an approval is unanswered, and repeat until nothing is pending.
 */
export class Conversation {
  private state: ConversationState = initialState;
  private readonly listeners = new Set<() => void>();
  private controller: AbortController | null = null;
  /** The run in progress, which settles once the conversation is idle or waits for an approval. */
  private running: Promise<void> | null = null;
  /** Incremented by `reset`, so a run that is still unwinding cannot touch the new conversation. */
  private generation = 0;
  /** The add-in's own function calls the user approved that have not run yet. */
  private readonly approvedCalls = new Set<string>();

  constructor(private readonly options: ConversationOptions) {}

  getState = (): ConversationState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  isBusy(): boolean {
    return isBusy(this.state);
  }

  /**
   * Sends a user message. The calls that wait for the user are closed first: the ones the user answered go on
   * with their answers, `answers` filled in on the card included, and approved function calls of the add-in run;
   * an approval left unanswered is declined and a question left unanswered is skipped.
   */
  async send(text: string, files: readonly ChatFile[] = [], answers: readonly PendingAnswer[] = []): Promise<void> {
    const content = text.trim();
    if ((content.length === 0 && files.length === 0) || this.isBusy()) {
      return;
    }
    const generation = this.generation;
    const responses = pendingApprovalRequests(this.state.items).map((request): McpApprovalResponseItem => {
      const given = answers.find((answer) => answer.requestId === request.id);
      return given && request.chatuit_kind === "question"
        ? {
            type: "mcp_approval_response",
            approval_request_id: request.id,
            approve: true,
            chatuit_answers: given.answers,
          }
        : { type: "mcp_approval_response", approval_request_id: request.id, approve: false };
    });
    this.patch(generation, { items: [...this.state.items, ...responses], previews: {} });

    const open = openFunctionCalls(this.state.items);
    if (open.length > 0) {
      const controller = new AbortController();
      this.controller = controller;
      this.patch(generation, { status: "running_tools" });
      await this.runFunctionCalls(generation, open, controller.signal, true);
      if (this.controller === controller) {
        this.controller = null;
      }
      if (controller.signal.aborted) {
        this.patch(generation, { status: "idle", cancelled: true });
        return;
      }
    }

    // The turn ends here, and a new one starts with the message.
    const now = this.now();
    const index = this.state.items.length;
    const turns = [...endOpenTurn(this.state.turns, now), { start: index, startedAt: now, endedAt: null }];
    // Only the newest message carries the app's context: earlier copies are out of date and would pile up.
    const fileParts = files.map(toFilePart);
    const items = [...this.state.items.map(withoutContext), userMessage(content, fileParts, null)];
    // The message is shown at once. The app's context is read afterwards and added to it before the request.
    this.patch(generation, { items, turns, status: "streaming", error: null, cancelled: false });
    await this.run(async (signal) => {
      const context = await this.readContext(signal);
      if (context) {
        const withContext = [...this.state.items];
        withContext[index] = userMessage(content, fileParts, context);
        this.patch(generation, { items: withContext });
      }
    });
  }

  /**
   * Answers one approval request or question, from the server or for one of the add-in's own
   * function calls. The conversation goes on when nothing waits for the user any more.
   */
  async answerApproval(requestId: string, decision: ApprovalDecision): Promise<void> {
    if (this.isBusy()) {
      throw new Error("Wait for the current response to finish.");
    }

    if (this.state.previews[requestId]) {
      this.answerOwnCall(requestId, decision.approve);
    } else {
      this.answerServerRequest(requestId, decision);
    }

    if (!waitsForUser(this.state)) {
      await this.run();
    }
  }

  private answerServerRequest(requestId: string, decision: ApprovalDecision): void {
    const request = this.state.items.find(
      (item): item is McpApprovalRequestItem => item.type === "mcp_approval_request" && item.id === requestId
    );
    if (!request) {
      throw new Error("Unknown approval request.");
    }
    if (approvalState(this.state.items, request) !== "pending") {
      throw new Error("This approval request is no longer pending.");
    }

    const response: McpApprovalResponseItem = {
      type: "mcp_approval_response",
      approval_request_id: requestId,
      approve: decision.approve,
    };
    if (request.chatuit_kind === "question") {
      if (decision.approve) {
        const answers = decision.answers ?? [];
        if (answers.length !== (request.chatuit_questions?.length ?? 0)) {
          throw new Error("Give one answer per question.");
        }
        if (!answers.some((answer) => answer && (answer.selected.length > 0 || answer.text?.trim()))) {
          throw new Error("An answer picks an option or has text.");
        }
        response.chatuit_answers = answers;
      }
    } else if (decision.approve && decision.editedArguments !== undefined) {
      if (request.chatuit_preview?.allow_edit !== true) {
        throw new Error("This request does not allow edited arguments.");
      }
      if (!isJsonObjectString(decision.editedArguments)) {
        throw new Error("Edited arguments must be a JSON object.");
      }
      response.chatuit_edited_arguments = decision.editedArguments;
    }

    this.patch(this.generation, { items: [...this.state.items, response], error: null, cancelled: false });
  }

  /** An approved call runs when the conversation goes on; a declined one gets its output now. */
  private answerOwnCall(callId: string, approve: boolean): void {
    const previews = Object.fromEntries(Object.entries(this.state.previews).filter(([id]) => id !== callId));
    if (approve) {
      this.approvedCalls.add(callId);
      this.patch(this.generation, { previews, error: null, cancelled: false });
      return;
    }
    const output: FunctionCallOutputItem = {
      type: "function_call_output",
      call_id: callId,
      output: toolError(DECLINED),
    };
    this.patch(this.generation, { items: [...this.state.items, output], previews, error: null, cancelled: false });
  }

  /** Stops the response or tool call in progress. */
  cancel(): void {
    this.controller?.abort();
  }

  /** Stops the response or tool call in progress and resolves once the conversation has recorded it. */
  async stop(): Promise<void> {
    this.cancel();
    await this.running;
  }

  /** Starts a new, empty conversation. */
  reset(): void {
    this.controller?.abort();
    this.controller = null;
    this.generation += 1;
    this.approvedCalls.clear();
    this.state = initialState;
    this.emit();
  }

  /**
   * Replaces the conversation with a saved one. A saved approval that is still pending can be
   * answered, and so can a saved function call that waited for the user's approval.
   */
  load(saved: SavedConversation): void {
    this.reset();
    const waiting = openFunctionCalls(saved.items).filter((call) => this.toolFor(call)?.preview);
    const awaiting = pendingApprovalRequests(saved.items).length > 0 || waiting.length > 0;
    this.state = {
      ...initialState,
      ...saved,
      status: awaiting ? "awaiting_approval" : "idle",
      turns: awaiting ? saved.turns : endOpenTurn(saved.turns, this.now()),
    };
    this.emit();
    const generation = this.generation;
    for (const call of waiting) {
      void this.preview(call).then((preview) =>
        this.patch(generation, { previews: { ...this.state.previews, [call.call_id]: preview } })
      );
    }
  }

  /** Runs the loop. `prepare` runs first, and the user can stop it like a response. */
  private async run(prepare?: (signal: AbortSignal) => Promise<void>): Promise<void> {
    const run = this.loop(prepare);
    this.running = run;
    try {
      await run;
    } finally {
      if (this.running === run) {
        this.running = null;
      }
    }
  }

  private async loop(prepare?: (signal: AbortSignal) => Promise<void>): Promise<void> {
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    const { signal } = controller;

    try {
      await prepare?.(signal);
      if (signal.aborted) {
        this.patch(generation, { status: "idle", cancelled: true });
        return;
      }
      for (;;) {
        // Function calls that waited for the user's approval run before the next response.
        let calls: FunctionCallItem[] = openFunctionCalls(this.state.items);
        if (calls.length === 0) {
          this.patch(generation, { status: "streaming", live: [] });
          const output = await this.streamResponse(generation, signal);
          if (output === null) {
            this.patch(generation, {
              status: "idle",
              live: [],
              cancelled: true,
              activity: finishActivity(this.state.activity),
            });
            return;
          }

          const items = [...this.state.items];
          const thoughts = [...this.state.thoughts];
          for (const outputItem of output) {
            if (outputItem.type === "reasoning") {
              thoughts.push({ position: items.length, id: outputItem.id });
            }
            const item = toInputItem(outputItem);
            if (item) {
              items.push(item);
            }
          }
          const produced = items.slice(this.state.items.length);
          this.patch(generation, { items, thoughts, live: [], activity: finishActivity(this.state.activity) });
          calls = produced.filter((item): item is FunctionCallItem => item.type === "function_call");
        }

        if (calls.length > 0) {
          this.patch(generation, { status: "running_tools" });
          await this.runFunctionCalls(generation, calls, signal);
          if (signal.aborted) {
            this.patch(generation, { status: "idle", cancelled: true });
            return;
          }
        }

        if (waitsForUser(this.state)) {
          this.patch(generation, { status: "awaiting_approval" });
          return;
        }
        if (calls.length === 0) {
          this.patch(generation, { status: "idle" });
          return;
        }
      }
    } catch (error) {
      if (signal.aborted) {
        this.patch(generation, {
          status: "idle",
          live: [],
          runningCallId: null,
          cancelled: true,
          activity: finishActivity(this.state.activity),
        });
      } else {
        this.patch(generation, {
          status: "idle",
          live: [],
          runningCallId: null,
          error: describeError(error),
          activity: finishActivity(this.state.activity),
        });
      }
    } finally {
      if (this.controller === controller) {
        this.controller = null;
      }
    }
  }

  /** Returns the response's output items, or null when the user aborted. */
  private async streamResponse(generation: number, signal: AbortSignal): Promise<OutputItem[] | null> {
    const request: CreateResponseRequest = { model: this.options.model, input: [...this.state.items] };
    if (this.options.instructions) {
      request.instructions = this.options.instructions;
    }
    if (this.options.tools.length > 0) {
      request.tools = this.options.tools.map((tool) => ({
        type: "function",
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
    }

    const events = await this.options.client.stream(request, signal);
    let live: OutputItem[] = [];
    let output: OutputItem[] | null = null;

    for await (const event of events) {
      if (signal.aborted) {
        break;
      }
      if (event.type === "response.completed") {
        const final = event.response.output;
        output = Array.isArray(final) && final.length > 0 ? final : live.filter((item) => !!item);
        continue;
      }
      if (event.type === "response.failed") {
        throw new Error(event.response.error?.message || "The response failed.");
      }
      if (event.type === "error") {
        throw new Error(event.message || "The server reported an error.");
      }
      const next = applyStreamEvent(live, event);
      const activity = applyActivityEvent(this.state.activity, event);
      if (next !== live || activity !== this.state.activity) {
        live = next;
        this.patch(generation, { live, activity });
      }
    }

    // The SDK ends the stream without an error when the request is aborted.
    if (signal.aborted) {
      return null;
    }
    if (output === null) {
      throw new Error("The response stream ended before the response completed.");
    }
    return output;
  }

  /**
   * Runs the calls in order and appends their outputs. Stops at a call whose tool asks the user
   * first and that the user has not approved: its preview is stored, and it and the calls after it
   * run once the user has answered. When `closing`, such a call is declined instead, because the
   * user wrote a new message.
   */
  private async runFunctionCalls(
    generation: number,
    calls: readonly FunctionCallItem[],
    signal: AbortSignal,
    closing = false
  ): Promise<void> {
    // Every function_call must get an output, or the server rejects the next request. Calls after a failed
    // call are not run, because they usually depend on it; the model sees which call failed and why.
    let failed: FunctionCallItem | null = null;
    for (const call of calls) {
      let output: FunctionCallOutputItem["output"];
      if (signal.aborted) {
        output = toolError("Cancelled by the user before the tool ran.");
      } else if (failed) {
        output = toolError(`Not run, because the earlier call ${failed.name} (${failed.call_id}) failed.`);
      } else if (this.toolFor(call)?.preview && !this.approvedCalls.has(call.call_id) && closing) {
        output = toolError(DECLINED);
        failed = call;
      } else if (this.toolFor(call)?.preview && !this.approvedCalls.has(call.call_id)) {
        const preview = await this.preview(call);
        this.patch(generation, { previews: { ...this.state.previews, [call.call_id]: preview } });
        return;
      } else {
        this.approvedCalls.delete(call.call_id);
        this.patch(generation, { runningCallId: call.call_id });
        const result = await this.executeTool(call, signal);
        if (result.ok) {
          output = result.output;
        } else {
          output = toolError(result.error);
          failed = call;
          if (!signal.aborted) {
            this.options.onToolError?.({ name: call.name, arguments: call.arguments, error: result.error });
          }
        }
      }
      const item: FunctionCallOutputItem = { type: "function_call_output", call_id: call.call_id, output };
      this.patch(generation, { items: [...this.state.items, item], runningCallId: null });
    }
  }

  private toolFor(call: FunctionCallItem): ClientToolDefinition | undefined {
    return this.options.tools.find((candidate) => candidate.name === call.name);
  }

  /** The preview the user approves before the call runs. A preview that fails shows the call as it is. */
  private async preview(call: FunctionCallItem): Promise<ApprovalPreview> {
    const fallback: ApprovalPreview = {
      title: call.name,
      fields: [{ label: "Arguments", value: call.arguments, multiline: true }],
      allow_edit: false,
    };
    try {
      const args: unknown = call.arguments.trim() === "" ? {} : JSON.parse(call.arguments);
      return isPlainObject(args) ? ((await this.toolFor(call)?.preview?.(args)) ?? fallback) : fallback;
    } catch {
      return fallback;
    }
  }

  private async executeTool(
    call: FunctionCallItem,
    signal: AbortSignal
  ): Promise<{ ok: true; output: FunctionCallOutputItem["output"] } | { ok: false; error: string }> {
    const tool = this.options.tools.find((candidate) => candidate.name === call.name);
    if (!tool) {
      return { ok: false, error: `Unknown tool "${call.name}".` };
    }
    let args: unknown;
    try {
      args = call.arguments.trim() === "" ? {} : JSON.parse(call.arguments);
    } catch {
      return { ok: false, error: "The arguments are not valid JSON." };
    }
    if (!isPlainObject(args)) {
      return { ok: false, error: "The arguments must be a JSON object." };
    }
    try {
      const result = await tool.handler(args, signal);
      if (result instanceof ToolResultWithImages) {
        return {
          ok: true,
          output: [
            { type: "input_text", text: JSON.stringify(result.value ?? null) },
            ...result.images.map((image) => ({
              type: "input_image" as const,
              image_url: `data:${image.mediaType};base64,${image.base64}`,
            })),
          ],
        };
      }
      return { ok: true, output: JSON.stringify(result ?? null) };
    } catch (error) {
      return { ok: false, error: signal.aborted ? "Cancelled by the user." : describeError(error) };
    }
  }

  /**
   * The app's context, or null when there is none, it cannot be read, or `signal` aborts first. A failure never
   * blocks the message.
   */
  private async readContext(signal: AbortSignal): Promise<string | null> {
    const aborted = new Promise<null>((resolve) =>
      signal.addEventListener("abort", () => resolve(null), { once: true })
    );
    try {
      return (await Promise.race([this.options.getContext?.() ?? null, aborted])) ?? null;
    } catch {
      return null;
    }
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private patch(generation: number, patch: Partial<ConversationState>): void {
    if (generation !== this.generation) {
      return;
    }
    this.state = { ...this.state, ...patch };
    // Idle means nothing is pending: done, stopped or failed. That ends the turn.
    if (patch.status === "idle") {
      this.state = { ...this.state, turns: endOpenTurn(this.state.turns, this.now()) };
    }
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

/** True while a response streams or tools run. */
export function isBusy(state: ConversationState): boolean {
  return state.status === "streaming" || state.status === "running_tools";
}

/** True while an approval request, a question or one of the add-in's own function calls waits for the user. */
export function waitsForUser(state: ConversationState): boolean {
  return pendingApprovalRequests(state.items).length > 0 || Object.keys(state.previews).length > 0;
}

/** The function calls since the last user message that have no output yet. */
export function openFunctionCalls(items: readonly InputItem[]): FunctionCallItem[] {
  const answered = new Set(
    items
      .filter((item): item is FunctionCallOutputItem => item.type === "function_call_output")
      .map((item) => item.call_id)
  );
  return items
    .slice(lastUserMessage(items) + 1)
    .filter((item): item is FunctionCallItem => item.type === "function_call" && !answered.has(item.call_id));
}

function lastUserMessage(items: readonly InputItem[]): number {
  let lastUser = -1;
  items.forEach((item, index) => {
    if (item.type === "message" && item.role === "user") {
      lastUser = index;
    }
  });
  return lastUser;
}

function endOpenTurn(turns: readonly Turn[], now: number): readonly Turn[] {
  const last = turns[turns.length - 1];
  return last && last.endedAt === null ? [...turns.slice(0, -1), { ...last, endedAt: now }] : turns;
}

/** Approval requests since the last user message that have no response yet. */
export function pendingApprovalRequests(items: readonly InputItem[]): McpApprovalRequestItem[] {
  const lastUser = lastUserMessage(items);
  const answered = new Set(
    items
      .filter((item): item is McpApprovalResponseItem => item.type === "mcp_approval_response")
      .map((item) => item.approval_request_id)
  );
  return items
    .slice(lastUser + 1)
    .filter((item): item is McpApprovalRequestItem => item.type === "mcp_approval_request")
    .filter((item) => !answered.has(item.id));
}

export function approvalState(items: readonly InputItem[], request: McpApprovalRequestItem): ApprovalState {
  const response = items.find(
    (item): item is McpApprovalResponseItem =>
      item.type === "mcp_approval_response" && item.approval_request_id === request.id
  );
  if (response) {
    return response.approve ? "approved" : "rejected";
  }
  return pendingApprovalRequests(items).some((item) => item.id === request.id) ? "pending" : "unanswered";
}

/** Applies one stream event to the live output items. Returns the same array when nothing changed. */
export function applyStreamEvent(live: OutputItem[], event: StreamEvent): OutputItem[] {
  switch (event.type) {
    case "response.output_item.added":
    case "response.output_item.done":
      return replaceAt(live, event.output_index, cloneItem(event.item));

    case "response.content_part.added":
      return updateMessagePart(live, event.output_index, event.content_index, () => ({ ...event.part }));

    case "response.output_text.delta":
      return updateMessagePart(live, event.output_index, event.content_index, (part) => ({
        type: "output_text",
        text: (part?.text ?? "") + event.delta,
      }));

    case "response.output_text.done":
      return updateMessagePart(live, event.output_index, event.content_index, () => ({
        type: "output_text",
        text: event.text,
      }));

    case "response.function_call_arguments.delta":
    case "response.function_call_arguments.done": {
      const item = live[event.output_index];
      if (item?.type !== "function_call") {
        return live;
      }
      const args =
        event.type === "response.function_call_arguments.delta" ? item.arguments + event.delta : event.arguments;
      return replaceAt(live, event.output_index, { ...item, arguments: args });
    }

    case "response.mcp_call.in_progress":
    case "response.mcp_call.completed":
    case "response.mcp_call.failed": {
      const index = live.findIndex((item) => item?.type === "mcp_call" && item.id === event.item_id);
      const item = live[index];
      if (item?.type !== "mcp_call") {
        return live;
      }
      const status = event.type.slice("response.mcp_call.".length);
      return replaceAt(live, index, { ...item, status });
    }

    default:
      return live;
  }
}

/**
 * Applies one stream event to the display-only activity: reasoning summaries (top level and inside
 * an mcp_call) and the names of an mcp_call's inner calls. Returns the same record when nothing changed.
 */
export function applyActivityEvent(
  activity: Readonly<Record<string, ItemActivity>>,
  event: StreamEvent
): Readonly<Record<string, ItemActivity>> {
  switch (event.type) {
    case "response.reasoning_summary_part.added":
    case "response.chatuit_mcp_call.reasoning_summary_part.added":
      return updateActivity(activity, event.item_id, (current) =>
        current.entries.some((entry) => entry.kind === "summary" && entry.index === event.summary_index)
          ? current
          : {
              ...current,
              entries: [...current.entries, { kind: "summary", index: event.summary_index }],
              summaries: setAt(current.summaries, event.summary_index, current.summaries[event.summary_index] ?? ""),
            }
      );

    case "response.reasoning_summary_text.delta":
    case "response.chatuit_mcp_call.reasoning_summary_text.delta":
      return updateActivity(activity, event.item_id, (current) => ({
        ...withSummaryEntry(current, event.summary_index),
        summaries: setAt(
          current.summaries,
          event.summary_index,
          (current.summaries[event.summary_index] ?? "") + event.delta
        ),
      }));

    case "response.reasoning_summary_text.done":
      return updateActivity(activity, event.item_id, (current) => ({
        ...withSummaryEntry(current, event.summary_index),
        summaries: setAt(current.summaries, event.summary_index, event.text),
      }));

    case "response.chatuit_mcp_call.inner_call":
      return updateActivity(activity, event.item_id, (current) => ({
        ...current,
        entries: [...current.entries, { kind: "call", name: event.name }],
      }));

    case "response.mcp_call.completed":
    case "response.mcp_call.failed":
      return activity[event.item_id]
        ? updateActivity(activity, event.item_id, (current) => ({ ...current, done: true }))
        : activity;

    case "response.output_item.done": {
      const item = event.item;
      if (item.type === "reasoning") {
        const summaries = (item.summary ?? []).map((part) => part.text);
        return updateActivity(activity, item.id, (current) =>
          current.entries.length === 0 && summaries.length > 0
            ? { entries: summaries.map((_, index) => ({ kind: "summary", index })), summaries, done: true }
            : { ...current, done: true }
        );
      }
      if (item.type === "mcp_call" && activity[item.id]) {
        // Completed, failed, or deferred (the item ends as incomplete).
        return updateActivity(activity, item.id, (current) => ({ ...current, done: true }));
      }
      return activity;
    }

    default:
      return activity;
  }
}

/** Marks every activity as finished, for when a response ends or stops. */
export function finishActivity(
  activity: Readonly<Record<string, ItemActivity>>
): Readonly<Record<string, ItemActivity>> {
  if (Object.values(activity).every((entry) => entry.done)) {
    return activity;
  }
  const next: Record<string, ItemActivity> = {};
  for (const [id, entry] of Object.entries(activity)) {
    next[id] = entry.done ? entry : { ...entry, done: true };
  }
  return next;
}

const emptyActivity: ItemActivity = { entries: [], summaries: [], done: false };

function updateActivity(
  activity: Readonly<Record<string, ItemActivity>>,
  id: string,
  update: (current: ItemActivity) => ItemActivity
): Readonly<Record<string, ItemActivity>> {
  const current = activity[id] ?? emptyActivity;
  const next = update(current);
  return next === current ? activity : { ...activity, [id]: next };
}

function withSummaryEntry(current: ItemActivity, index: number): ItemActivity {
  return current.entries.some((entry) => entry.kind === "summary" && entry.index === index)
    ? current
    : { ...current, entries: [...current.entries, { kind: "summary", index }] };
}

function setAt(values: readonly string[], index: number, value: string): string[] {
  const next = [...values];
  for (let i = next.length; i < index; i++) {
    next[i] = "";
  }
  next[index] = value;
  return next;
}

/** Projects an output item to the input item shape of the wire contract. Unknown items are dropped. */
export function toInputItem(item: OutputItem): InputItem | null {
  switch (item.type) {
    case "message": {
      const content = item.content
        .filter(
          (part): part is TextPart =>
            (part.type === "output_text" || part.type === "input_text") && typeof part.text === "string"
        )
        .map((part): TextPart => ({ type: part.type, text: part.text }));
      return content.length > 0 ? { type: "message", role: item.role, content } : null;
    }
    case "function_call":
      return { type: "function_call", call_id: item.call_id, name: item.name, arguments: item.arguments };
    case "reasoning":
      return typeof item.encrypted_content === "string"
        ? { type: "reasoning", id: item.id, encrypted_content: item.encrypted_content }
        : null;
    case "mcp_call": {
      const call: McpCallItem = {
        type: "mcp_call",
        id: item.id,
        server_label: item.server_label,
        name: item.name,
        arguments: item.arguments,
      };
      if (typeof item.output === "string") {
        call.output = item.output;
      }
      if (typeof item.error === "string") {
        call.error = item.error;
      }
      if (typeof item.approval_request_id === "string") {
        call.approval_request_id = item.approval_request_id;
      }
      return call;
    }
    case "mcp_approval_request": {
      const request: McpApprovalRequestItem = {
        type: "mcp_approval_request",
        id: item.id,
        server_label: item.server_label,
        name: item.name,
        arguments: item.arguments,
        chatuit_kind: item.chatuit_kind,
      };
      const preview = item.chatuit_preview;
      if (preview) {
        request.chatuit_preview = {
          title: preview.title,
          fields: preview.fields.map((field) => ({ ...field })),
          allow_edit: preview.allow_edit,
        };
        if (typeof preview.summary === "string") {
          request.chatuit_preview.summary = preview.summary;
        }
        if (preview.kind) {
          request.chatuit_preview.kind = preview.kind;
        }
      }
      const questions = item.chatuit_questions;
      if (questions) {
        request.chatuit_questions = questions.map((question) => ({
          question: question.question,
          options: question.options.map((option) => ({ ...option })),
          multi_select: question.multi_select,
        }));
      }
      return request;
    }
    default:
      return null;
  }
}

function updateMessagePart(
  live: OutputItem[],
  outputIndex: number,
  contentIndex: number,
  update: (part: { type: string; text?: string } | undefined) => { type: string; text?: string }
): OutputItem[] {
  const item = live[outputIndex];
  if (item?.type !== "message") {
    return live;
  }
  const content = [...item.content];
  content[contentIndex] = update(content[contentIndex]);
  return replaceAt(live, outputIndex, { ...item, content });
}

function replaceAt(live: OutputItem[], index: number, item: OutputItem): OutputItem[] {
  const next = [...live];
  next[index] = item;
  return next;
}

function cloneItem(item: OutputItem): OutputItem {
  return item.type === "message" ? { ...item, content: item.content.map((part) => ({ ...part })) } : { ...item };
}

function isPlainObject(value: unknown): value is ToolArguments {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonObjectString(text: string): boolean {
  try {
    return isPlainObject(JSON.parse(text));
  } catch {
    return false;
  }
}

function toolError(message: string): string {
  return JSON.stringify({ error: message });
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
