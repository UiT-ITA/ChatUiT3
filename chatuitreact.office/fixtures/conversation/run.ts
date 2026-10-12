/* global AbortSignal, console, process */

/**
 * Runs the conversation loop against scripted server responses written from the wire contract.
 * Uses the real openai SDK client with a mocked fetch. Run with `npm run test:fixtures`.
 */

import assert from "node:assert/strict";
import { createResponsesClient } from "../../src/chat/api/client";
import type { McpApprovalRequestItem } from "../../src/chat/api/types";
import {
  approvalState,
  CONTEXT_PREFIX,
  Conversation,
  pendingApprovalRequests,
  type ConversationState,
} from "../../src/chat/conversation/conversation";
import { ToolResultWithImages, type ClientToolDefinition, type ToolArguments } from "../../src/chat/tools/types";
import { mockServer, sse, type ScriptedEvent } from "./mockServer";
import { renderOutline } from "./render";

const BASE_URL = "https://localhost:7254/api/v1";

interface Harness {
  conversation: Conversation;
  requests: ReturnType<typeof mockServer>["requests"];
  toolCalls: ToolArguments[];
  /** Every distinct live assistant text seen while streaming, in order. */
  liveTexts: string[];
  /** Every distinct live mcp_call status seen while streaming, in order. */
  liveMcpStatuses: string[];
}

function setup(
  script: ScriptedEvent[][],
  now?: () => number,
  extraTools: ClientToolDefinition[] = [],
  getContext?: () => Promise<string | null>
): Harness {
  const server = mockServer(script);
  let tokenNumber = 0;
  const client = createResponsesClient({
    baseURL: BASE_URL,
    getToken: async () => `token-${++tokenNumber}`,
    fetch: server.fetch,
  });

  const toolCalls: ToolArguments[] = [];
  const selectionTool: ClientToolDefinition = {
    name: "word_get_selection",
    description: "Get the selected text.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    handler: async (args, signal) => {
      assert.ok(signal instanceof AbortSignal, "handler receives an AbortSignal");
      toolCalls.push(args);
      return { text: "Hello world", paragraphIds: ["p-1"] };
    },
  };

  const conversation = new Conversation({
    client,
    model: "office",
    tools: [selectionTool, ...extraTools],
    now,
    getContext,
  });
  const liveTexts: string[] = [];
  const liveMcpStatuses: string[] = [];
  conversation.subscribe(() => {
    for (const item of conversation.getState().live) {
      if (item?.type === "message") {
        const text = item.content.map((part) => part.text ?? "").join("");
        if (text && liveTexts[liveTexts.length - 1] !== text) {
          liveTexts.push(text);
        }
      }
      if (item?.type === "mcp_call" && item.status && liveMcpStatuses[liveMcpStatuses.length - 1] !== item.status) {
        liveMcpStatuses.push(item.status);
      }
    }
  });

  return { conversation, requests: server.requests, toolCalls, liveTexts, liveMcpStatuses };
}

/** A clock that returns the given times, one per read, and fails on an unexpected read. */
function clock(times: number[]): () => number {
  return () => {
    const time = times.shift();
    assert.ok(time !== undefined, "the clock is read once at send and once at the end of each turn");
    return time;
  };
}

const userMessage = (content: string) => ({ type: "message", role: "user", content });
const assistantMessage = (text: string) => ({
  type: "message",
  role: "assistant",
  content: [{ type: "output_text", text }],
});

const cases: Array<[string, () => Promise<void>]> = [
  [
    "text streaming",
    async () => {
      const h = setup([
        [
          sse.created(),
          sse.inProgress(),
          ...sse.textMessage(0, "msg_1", ["Hel", "lo ", "there!"]),
          sse.completed([sse.messageItem("msg_1", "Hello there!")]),
        ],
      ]);
      await h.conversation.send("Hi");

      assert.equal(h.requests.length, 1);
      const [request] = h.requests;
      assert.equal(request.url, `${BASE_URL}/responses`);
      assert.equal(request.method, "POST");
      assert.equal(request.authorization, "Bearer token-1");
      assert.deepEqual(Object.keys(request.body).sort(), ["input", "model", "stream", "tools"]);
      assert.equal(request.body.model, "office");
      assert.equal(request.body.stream, true);
      assert.deepEqual(request.body.input, [userMessage("Hi")]);
      assert.deepEqual(request.body.tools, [
        {
          type: "function",
          name: "word_get_selection",
          description: "Get the selected text.",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      ]);

      assert.deepEqual(h.liveTexts, ["Hel", "Hello ", "Hello there!"]);
      const state = h.conversation.getState();
      assert.equal(state.status, "idle");
      assert.equal(state.error, null);
      assert.deepEqual(state.live, []);
      assert.deepEqual(state.items, [userMessage("Hi"), assistantMessage("Hello there!")]);
    },
  ],
  [
    "function_call round trip",
    async () => {
      const call = {
        type: "function_call",
        id: "fc_1",
        call_id: "call_1",
        name: "word_get_selection",
        status: "completed",
        arguments: "{}",
      };
      const h = setup([
        [
          sse.created(),
          sse.itemAdded(0, { ...call, status: "in_progress", arguments: "" }),
          { type: "response.function_call_arguments.delta", output_index: 0, item_id: "fc_1", delta: "{" },
          { type: "response.function_call_arguments.delta", output_index: 0, item_id: "fc_1", delta: "}" },
          { type: "response.function_call_arguments.done", output_index: 0, item_id: "fc_1", arguments: "{}" },
          sse.itemDone(0, call),
          sse.completed([call]),
        ],
        [
          sse.created(),
          ...sse.textMessage(0, "msg_2", ["It says Hello world."]),
          sse.completed([sse.messageItem("msg_2", "It says Hello world.")]),
        ],
      ]);
      await h.conversation.send("What is selected?");

      assert.deepEqual(h.toolCalls, [{}]);
      assert.equal(h.requests.length, 2);
      assert.equal(h.requests[0].authorization, "Bearer token-1");
      assert.equal(h.requests[1].authorization, "Bearer token-2", "a fresh token per request");

      const expectedHistory = [
        userMessage("What is selected?"),
        { type: "function_call", call_id: "call_1", name: "word_get_selection", arguments: "{}" },
        {
          type: "function_call_output",
          call_id: "call_1",
          output: JSON.stringify({ text: "Hello world", paragraphIds: ["p-1"] }),
        },
      ];
      assert.deepEqual(h.requests[1].body.input, expectedHistory);

      const state = h.conversation.getState();
      assert.equal(state.status, "idle");
      assert.equal(state.error, null);
      assert.deepEqual(state.items, [...expectedHistory, assistantMessage("It says Hello world.")]);

      // A Word tool is shown by name and status only.
      const text = renderOutline(state);
      assert.match(text, /word_get_selection\n {2}Done/);
      assert.doesNotMatch(text, /paragraphIds|Hello world"|Arguments|Result|Details/);
    },
  ],
  [
    "mcp_call",
    async () => {
      const running = {
        type: "mcp_call",
        id: "mcp_1",
        server_label: "chatuit",
        name: "m365_reader",
        arguments: '{"task":"meetings tomorrow"}',
        status: "in_progress",
      };
      const done = { ...running, status: "completed", output: "Two meetings: 09:00 Standup, 13:00 Review." };
      const h = setup([
        [
          sse.created(),
          sse.itemAdded(0, running),
          { type: "response.mcp_call.in_progress", output_index: 0, item_id: "mcp_1" },
          { type: "response.mcp_call.completed", output_index: 0, item_id: "mcp_1" },
          sse.itemDone(0, done),
          ...sse.textMessage(1, "msg_1", ["You have two meetings."]),
          sse.completed([done, sse.messageItem("msg_1", "You have two meetings.")]),
        ],
        [
          sse.created(),
          ...sse.textMessage(0, "msg_2", ["You're welcome."]),
          sse.completed([sse.messageItem("msg_2", "You're welcome.")]),
        ],
      ]);
      await h.conversation.send("What meetings do I have tomorrow?");

      assert.equal(h.requests.length, 1, "a server tool does not end the response");
      assert.deepEqual(h.liveMcpStatuses, ["in_progress", "completed"]);
      const projected = {
        type: "mcp_call",
        id: "mcp_1",
        server_label: "chatuit",
        name: "m365_reader",
        arguments: '{"task":"meetings tomorrow"}',
        output: "Two meetings: 09:00 Standup, 13:00 Review.",
      };
      assert.deepEqual(h.conversation.getState().items, [
        userMessage("What meetings do I have tomorrow?"),
        projected,
        assistantMessage("You have two meetings."),
      ]);

      await h.conversation.send("Thanks");
      assert.equal(h.requests.length, 2);
      assert.deepEqual(h.requests[1].body.input, [
        userMessage("What meetings do I have tomorrow?"),
        projected,
        assistantMessage("You have two meetings."),
        userMessage("Thanks"),
      ]);
      assert.equal(h.conversation.getState().status, "idle");
    },
  ],
  [
    "confirmation mcp_approval_request without allow_edit",
    async () => {
      const request = {
        type: "mcp_approval_request",
        id: "sealed-confirm-0",
        server_label: "chatuit",
        name: "m365_reader",
        arguments: '{"task":"meetings tomorrow"}',
        chatuit_kind: "confirmation",
        chatuit_preview: { title: "Read meetings", fields: [], allow_edit: false },
      };
      const call = {
        type: "mcp_call",
        id: "mcp_2",
        server_label: "chatuit",
        name: "m365_reader",
        arguments: '{"task":"meetings tomorrow"}',
        output: "No meetings.",
        status: "completed",
      };
      const h = setup([
        [sse.created(), sse.itemAdded(0, request), sse.itemDone(0, request), sse.completed([request])],
        [
          sse.created(),
          sse.itemAdded(0, { ...call, output: null, status: "in_progress" }),
          sse.itemDone(0, call),
          ...sse.textMessage(1, "msg_1", ["You have no meetings."]),
          sse.completed([call, sse.messageItem("msg_1", "You have no meetings.")]),
        ],
      ]);
      await h.conversation.send("What meetings do I have tomorrow?");

      let state = h.conversation.getState();
      assert.equal(h.requests.length, 1);
      assert.equal(state.status, "awaiting_approval");
      const pending = pendingApprovalRequests(state.items);
      assert.deepEqual(pending, [request]);
      assert.equal(approvalState(state.items, pending[0]), "pending");

      await assert.rejects(
        h.conversation.answerApproval("sealed-confirm-0", { approve: true, editedArguments: "{}" }),
        /does not allow edited arguments/
      );
      assert.equal(h.requests.length, 1, "a refused answer sends nothing");

      await h.conversation.answerApproval("sealed-confirm-0", { approve: true });
      assert.equal(h.requests.length, 2);
      assert.deepEqual(h.requests[1].body.input, [
        userMessage("What meetings do I have tomorrow?"),
        request,
        { type: "mcp_approval_response", approval_request_id: "sealed-confirm-0", approve: true },
      ]);

      state = h.conversation.getState();
      assert.equal(state.status, "idle");
      assert.equal(state.error, null);
      assert.equal(approvalState(state.items, request as McpApprovalRequestItem), "approved");
      assert.deepEqual(state.items.slice(-2), [
        {
          type: "mcp_call",
          id: "mcp_2",
          server_label: "chatuit",
          name: "m365_reader",
          arguments: '{"task":"meetings tomorrow"}',
          output: "No meetings.",
        },
        assistantMessage("You have no meetings."),
      ]);
    },
  ],
  [
    "confirmation mcp_approval_request with allow_edit",
    async () => {
      const request = {
        type: "mcp_approval_request",
        id: "sealed-confirm-1",
        server_label: "chatuit",
        name: "create_calendar_event",
        arguments: '{"title":"Planning","start":"2026-09-30T09:00"}',
        chatuit_kind: "confirmation",
        chatuit_preview: {
          title: "Create calendar event",
          summary: "Adds an event to your calendar.",
          fields: [
            { label: "Title", value: "Planning", multiline: false },
            { label: "Notes", value: "Line 1\nLine 2", multiline: true },
          ],
          allow_edit: true,
        },
      };
      const edited = '{"title":"Planning v2","start":"2026-09-30T10:00"}';
      const call = {
        type: "mcp_call",
        id: "mcp_3",
        server_label: "chatuit",
        name: "create_calendar_event",
        arguments: edited,
        output: "Created.",
        status: "completed",
      };
      const h = setup([
        [sse.created(), sse.itemAdded(0, request), sse.itemDone(0, request), sse.completed([request])],
        [
          sse.created(),
          sse.itemAdded(0, { ...call, output: null, status: "in_progress" }),
          { type: "response.mcp_call.completed", output_index: 0, item_id: "mcp_3" },
          sse.itemDone(0, call),
          ...sse.textMessage(1, "msg_1", ["Created the event."]),
          sse.completed([call, sse.messageItem("msg_1", "Created the event.")]),
        ],
      ]);
      await h.conversation.send("Book planning tomorrow at nine");
      assert.equal(h.conversation.getState().status, "awaiting_approval");

      await assert.rejects(
        h.conversation.answerApproval("sealed-confirm-1", { approve: true, editedArguments: "[1]" }),
        /must be a JSON object/
      );

      await h.conversation.answerApproval("sealed-confirm-1", { approve: true, editedArguments: edited });
      assert.equal(h.requests.length, 2);
      assert.deepEqual(h.requests[1].body.input, [
        userMessage("Book planning tomorrow at nine"),
        request,
        {
          type: "mcp_approval_response",
          approval_request_id: "sealed-confirm-1",
          approve: true,
          chatuit_edited_arguments: edited,
        },
      ]);

      const state = h.conversation.getState();
      assert.equal(state.status, "idle");
      assert.equal(state.error, null);
      assert.equal(approvalState(state.items, request as McpApprovalRequestItem), "approved");
      assert.deepEqual(state.items[state.items.length - 1], assistantMessage("Created the event."));
    },
  ],
  [
    "reasoning summary and mcp_call inner activity",
    async () => {
      const reasoning = {
        type: "reasoning",
        id: "rs_1",
        summary: [{ type: "summary_text", text: "**Planning** Look up the calendar." }],
        encrypted_content: "sealed-reasoning",
      };
      const running = {
        type: "mcp_call",
        id: "mcp_1",
        server_label: "chatuit",
        name: "m365_reader",
        arguments: '{"task":"meetings tomorrow"}',
        status: "in_progress",
      };
      const done = { ...running, status: "completed", output: "SECRET-OUTPUT two meetings" };
      const inner = (type: string, extra: Record<string, unknown>): ScriptedEvent => ({
        type: `response.chatuit_mcp_call.${type}`,
        output_index: 1,
        item_id: "mcp_1",
        ...extra,
      });
      const h = setup(
        [
          [
            sse.created(),
            sse.itemAdded(0, { type: "reasoning", id: "rs_1", summary: [] }),
            {
              type: "response.reasoning_summary_part.added",
              output_index: 0,
              item_id: "rs_1",
              summary_index: 0,
              part: { type: "summary_text", text: "" },
            },
            {
              type: "response.reasoning_summary_text.delta",
              output_index: 0,
              item_id: "rs_1",
              summary_index: 0,
              delta: "**Planning** Look up ",
            },
            {
              type: "response.reasoning_summary_text.delta",
              output_index: 0,
              item_id: "rs_1",
              summary_index: 0,
              delta: "the calendar.",
            },
            {
              type: "response.reasoning_summary_text.done",
              output_index: 0,
              item_id: "rs_1",
              summary_index: 0,
              text: "**Planning** Look up the calendar.",
            },
            {
              type: "response.reasoning_summary_part.done",
              output_index: 0,
              item_id: "rs_1",
              summary_index: 0,
              part: reasoning.summary[0],
            },
            sse.itemDone(0, reasoning),
            sse.itemAdded(1, running),
            { type: "response.mcp_call.in_progress", output_index: 1, item_id: "mcp_1" },
            inner("inner_call", { name: "get_people" }),
            inner("reasoning_summary_part.added", { summary_index: 0 }),
            inner("reasoning_summary_text.delta", { summary_index: 0, delta: "Find the " }),
            inner("reasoning_summary_text.delta", { summary_index: 0, delta: "events." }),
            inner("inner_call", { name: "get_events" }),
            { type: "response.mcp_call.completed", output_index: 1, item_id: "mcp_1" },
            sse.itemDone(1, done),
            ...sse.textMessage(2, "msg_1", ["You have two meetings."]),
            sse.completed([reasoning, done, sse.messageItem("msg_1", "You have two meetings.")]),
          ],
          [
            sse.created(),
            ...sse.textMessage(0, "msg_2", ["Sure."]),
            sse.completed([sse.messageItem("msg_2", "Sure.")]),
          ],
        ],
        clock([0, 3_000, 10_000, 10_000])
      );

      // Snapshots taken while streaming: after the top-level summary streamed, and after the inner events.
      let reasoningLive: ConversationState | null = null;
      let innerLive: ConversationState | null = null;
      h.conversation.subscribe(() => {
        const state = h.conversation.getState();
        if (!reasoningLive && state.activity.rs_1?.summaries[0] === "**Planning** Look up the calendar.") {
          reasoningLive = state;
        }
        if (!innerLive && state.activity.mcp_1?.entries.length === 3) {
          innerLive = state;
        }
      });

      await h.conversation.send("What meetings do I have tomorrow?");
      assert.equal(h.requests.length, 1);

      // P-A5: the openai SDK passed the response.chatuit_* events through.
      const state = h.conversation.getState();
      assert.deepEqual(state.activity.mcp_1, {
        entries: [
          { kind: "call", name: "get_people" },
          { kind: "summary", index: 0 },
          { kind: "call", name: "get_events" },
        ],
        summaries: ["Find the events."],
        done: true,
      });
      assert.deepEqual(state.activity.rs_1, {
        entries: [{ kind: "summary", index: 0 }],
        summaries: ["**Planning** Look up the calendar."],
        done: true,
      });
      assert.deepEqual(state.thoughts, [{ position: 1, id: "rs_1" }]);

      // P-B1: while streaming, each summary part shows as its title, expandable to the full text.
      assert.ok(reasoningLive, "a live snapshot with the streamed summary");
      assert.equal(
        renderOutline(reasoningLive),
        ["What meetings do I have tomorrow?", "▸ Planning", "  Look up the calendar."].join("\n")
      );
      assert.ok(innerLive, "a live snapshot with the inner events");
      assert.equal((innerLive as ConversationState).activity.mcp_1.done, false);
      assert.equal(
        renderOutline(innerLive),
        [
          "What meetings do I have tomorrow?",
          "▸ Planning",
          "  Look up the calendar.",
          "m365_reader",
          "Running",
          "Calling get_people",
          "Find the events.",
          "Calling get_events",
        ].join("\n")
      );

      // P-B2: the finished turn collapses into the reply's meta row. Tools show name and status only.
      const finalText = renderOutline(state);
      assert.equal(
        finalText,
        [
          "What meetings do I have tomorrow?",
          "▸ ChatUiT",
          "▸ Worked for 3s",
          "  ▸ Planning",
          "    Look up the calendar.",
          "  m365_reader",
          "  Done",
          "  Calling get_people",
          "  Find the events.",
          "  Calling get_events",
          "You have two meetings.",
        ].join("\n")
      );
      assert.doesNotMatch(finalText, /SECRET-OUTPUT|meetings tomorrow"|Arguments|Result|Details/);

      // P-A4: inner activity is never sent back. The reasoning item goes back sealed only.
      await h.conversation.send("Thanks");
      assert.deepEqual(h.requests[1].body.input, [
        userMessage("What meetings do I have tomorrow?"),
        { type: "reasoning", id: "rs_1", encrypted_content: "sealed-reasoning" },
        {
          type: "mcp_call",
          id: "mcp_1",
          server_label: "chatuit",
          name: "m365_reader",
          arguments: '{"task":"meetings tomorrow"}',
          output: "SECRET-OUTPUT two meetings",
        },
        assistantMessage("You have two meetings."),
        userMessage("Thanks"),
      ]);
    },
  ],
  [
    "turn over several requests collapses to Worked for",
    async () => {
      const readingPart = "**Reading the document**\n\nI will read the selection first.";
      const reasoningA = {
        type: "reasoning",
        id: "rs_a",
        summary: [{ type: "summary_text", text: readingPart }],
        encrypted_content: "sealed-a",
      };
      const call = {
        type: "function_call",
        id: "fc_a",
        call_id: "call_a",
        name: "word_get_selection",
        status: "completed",
        arguments: "{}",
      };
      const calendarPart = "Checking the calendar next.\nThen I answer.";
      const reasoningB = {
        type: "reasoning",
        id: "rs_b",
        summary: [{ type: "summary_text", text: calendarPart }],
        encrypted_content: "sealed-b",
      };
      const running = {
        type: "mcp_call",
        id: "mcp_b",
        server_label: "chatuit",
        name: "m365_reader",
        arguments: '{"task":"SECRET-ARGS"}',
        status: "in_progress",
      };
      const done = { ...running, status: "completed", output: "SECRET-OUTPUT" };
      const inner = (type: string, extra: Record<string, unknown>): ScriptedEvent => ({
        type: `response.chatuit_mcp_call.${type}`,
        output_index: 1,
        item_id: "mcp_b",
        ...extra,
      });
      const summaryEvents = (index: number, id: string, text: string): ScriptedEvent[] => [
        {
          type: "response.reasoning_summary_part.added",
          output_index: index,
          item_id: id,
          summary_index: 0,
          part: { type: "summary_text", text: "" },
        },
        {
          type: "response.reasoning_summary_text.delta",
          output_index: index,
          item_id: id,
          summary_index: 0,
          delta: text.slice(0, 9),
        },
        {
          type: "response.reasoning_summary_text.delta",
          output_index: index,
          item_id: id,
          summary_index: 0,
          delta: text.slice(9),
        },
        { type: "response.reasoning_summary_text.done", output_index: index, item_id: id, summary_index: 0, text },
      ];

      const h = setup(
        [
          [
            sse.created(),
            sse.itemAdded(0, { type: "reasoning", id: "rs_a", summary: [] }),
            ...summaryEvents(0, "rs_a", readingPart),
            sse.itemDone(0, reasoningA),
            sse.itemAdded(1, { ...call, status: "in_progress", arguments: "" }),
            sse.itemDone(1, call),
            sse.completed([reasoningA, call]),
          ],
          [
            sse.created(),
            sse.itemAdded(0, { type: "reasoning", id: "rs_b", summary: [] }),
            ...summaryEvents(0, "rs_b", calendarPart),
            sse.itemDone(0, reasoningB),
            sse.itemAdded(1, running),
            { type: "response.mcp_call.in_progress", output_index: 1, item_id: "mcp_b" },
            inner("inner_call", { name: "get_people" }),
            inner("reasoning_summary_part.added", { summary_index: 0 }),
            inner("reasoning_summary_text.delta", { summary_index: 0, delta: "**Finding people** " }),
            inner("reasoning_summary_text.delta", { summary_index: 0, delta: "Looking up the names." }),
            inner("inner_call", { name: "get_events" }),
            { type: "response.mcp_call.completed", output_index: 1, item_id: "mcp_b" },
            sse.itemDone(1, done),
            ...sse.textMessage(2, "msg_b", ["Here is the summary."]),
            sse.completed([reasoningB, done, sse.messageItem("msg_b", "Here is the summary.")]),
          ],
        ],
        clock([1_000, 43_000])
      );

      let titleStreaming: ConversationState | null = null;
      let innerLive: ConversationState | null = null;
      h.conversation.subscribe(() => {
        const state = h.conversation.getState();
        if (!titleStreaming && state.activity.rs_a?.summaries[0] === readingPart.slice(0, 9)) {
          titleStreaming = state;
        }
        if (!innerLive && state.activity.mcp_b?.entries.length === 3) {
          innerLive = state;
        }
      });

      await h.conversation.send("Summarize and check my calendar");
      assert.equal(h.requests.length, 2);
      const state = h.conversation.getState();
      assert.equal(state.status, "idle");
      assert.deepEqual(state.turns, [{ start: 0, startedAt: 1_000, endedAt: 43_000 }]);

      // P-B1: a bold title shows as far as it has streamed, without the asterisks.
      assert.ok(titleStreaming, "a live snapshot while the first title streams");
      assert.equal(renderOutline(titleStreaming), ["Summarize and check my calendar", "Reading"].join("\n"));

      // While the turn runs, all activity is shown live: titles, Word tool, server tool, inner calls.
      assert.ok(innerLive, "a live snapshot with the inner events");
      assert.equal(
        renderOutline(innerLive),
        [
          "Summarize and check my calendar",
          "▸ Reading the document",
          "  I will read the selection first.",
          "word_get_selection",
          "Done",
          "▸ Checking the calendar next.",
          "  Then I answer.",
          "m365_reader",
          "Running",
          "Calling get_people",
          "▸ Finding people",
          "  Looking up the names.",
          "Calling get_events",
        ].join("\n")
      );

      // Done: one "Worked for 42s" line in the reply's meta row, holding every step in order.
      const finalText = renderOutline(state);
      assert.equal(
        finalText,
        [
          "Summarize and check my calendar",
          "▸ ChatUiT",
          "▸ Worked for 42s",
          "  ▸ Reading the document",
          "    I will read the selection first.",
          "  word_get_selection",
          "  Done",
          "  ▸ Checking the calendar next.",
          "    Then I answer.",
          "  m365_reader",
          "  Done",
          "  Calling get_people",
          "  ▸ Finding people",
          "    Looking up the names.",
          "  Calling get_events",
          "Here is the summary.",
        ].join("\n")
      );
      assert.doesNotMatch(finalText, /SECRET-ARGS|SECRET-OUTPUT|paragraphIds/);
    },
  ],
  [
    "turn that ends with an error collapses too",
    async () => {
      const reasoning = {
        type: "reasoning",
        id: "rs_e",
        summary: [{ type: "summary_text", text: "**Reading** the selection." }],
        encrypted_content: "sealed-e",
      };
      const call = {
        type: "function_call",
        id: "fc_e",
        call_id: "call_e",
        name: "word_get_selection",
        status: "completed",
        arguments: "{}",
      };
      // The second request gets the mock server's 500 error.
      const h = setup(
        [[sse.created(), sse.itemDone(0, reasoning), sse.itemDone(1, call), sse.completed([reasoning, call])]],
        clock([0, 5_000])
      );
      await h.conversation.send("Read it");

      const state = h.conversation.getState();
      assert.equal(state.status, "idle");
      assert.match(state.error ?? "", /No scripted response left/);
      assert.equal(
        renderOutline(state),
        [
          "Read it",
          "▸ ChatUiT",
          "▸ Worked for 5s",
          "  ▸ Reading",
          "    the selection.",
          "  word_get_selection",
          "  Done",
        ].join("\n")
      );
    },
  ],
  [
    "calls after a failed call in the same response are not run",
    async () => {
      const ran: string[] = [];
      const tool = (name: string, fail: boolean): ClientToolDefinition => ({
        name,
        description: name,
        parameters: { type: "object", properties: {}, additionalProperties: false },
        handler: async () => {
          ran.push(name);
          if (fail) {
            throw new Error("InvalidArgument: rejected");
          }
          return { ok: true };
        },
      });
      const call = (id: string, name: string) => ({
        type: "function_call" as const,
        id: `fc_${id}`,
        call_id: id,
        name,
        status: "completed" as const,
        arguments: "{}",
      });
      const calls = [call("c1", "tool_ok"), call("c2", "tool_fail"), call("c3", "tool_ok")];
      const h = setup(
        [
          [sse.created(), ...calls.map((item, index) => sse.itemDone(index, item)), sse.completed(calls)],
          [
            sse.created(),
            ...sse.textMessage(0, "msg_f", ["Failed."]),
            sse.completed([sse.messageItem("msg_f", "Failed.")]),
          ],
        ],
        undefined,
        [tool("tool_ok", false), tool("tool_fail", true)]
      );
      await h.conversation.send("Do three things");

      assert.deepEqual(ran, ["tool_ok", "tool_fail"], "the call after the failure does not run");
      const outputs = (h.requests[1].body.input as Array<{ type: string; output: string }>).filter(
        (item) => item.type === "function_call_output"
      );
      assert.deepEqual(
        outputs.map((item) => JSON.parse(item.output)),
        [
          { ok: true },
          { error: "InvalidArgument: rejected" },
          { error: "Not run, because the earlier call tool_fail (c2) failed." },
        ]
      );
    },
  ],
  [
    "tool output with pictures is sent as text and image parts",
    async () => {
      const picture: ClientToolDefinition = {
        name: "tool_picture",
        description: "Returns a picture.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        handler: async () => new ToolResultWithImages({ ok: true }, [{ mediaType: "image/png", base64: "AAAA" }]),
      };
      const call = {
        type: "function_call" as const,
        id: "fc_p",
        call_id: "p1",
        name: "tool_picture",
        status: "completed" as const,
        arguments: "{}",
      };
      const h = setup(
        [
          [sse.created(), sse.itemDone(0, call), sse.completed([call])],
          [
            sse.created(),
            ...sse.textMessage(0, "msg_p", ["Seen."]),
            sse.completed([sse.messageItem("msg_p", "Seen.")]),
          ],
        ],
        undefined,
        [picture]
      );
      await h.conversation.send("Look at it");

      const output = (h.requests[1].body.input as Array<{ type: string; output: unknown }>).find(
        (item) => item.type === "function_call_output"
      );
      assert.deepEqual(output?.output, [
        { type: "input_text", text: '{"ok":true}' },
        { type: "input_image", image_url: "data:image/png;base64,AAAA" },
      ]);
      assert.ok(renderOutline(h.conversation.getState()).includes("Seen."), "the chat still renders");
    },
  ],
  [
    "the app context is sent after the user's text and not shown in the chat",
    async () => {
      const h = setup(
        [[sse.created(), ...sse.textMessage(0, "msg_c", ["Hi."]), sse.completed([sse.messageItem("msg_c", "Hi.")])]],
        undefined,
        [],
        async () => "Excel. Active sheet: 'Sales'."
      );
      await h.conversation.send("Hello");

      const message = (h.requests[0].body.input as Array<{ type: string; content: unknown }>)[0];
      assert.deepEqual(message.content, [
        { type: "input_text", text: "Hello" },
        { type: "input_text", text: `${CONTEXT_PREFIX}Excel. Active sheet: 'Sales'.` },
      ]);
      const outline = renderOutline(h.conversation.getState());
      assert.ok(outline.includes("Hello"), "the user's text is shown");
      assert.ok(!outline.includes("Active sheet"), "the context is not shown");
    },
  ],
  [
    "attached files go after the user's text and before the context, and stay in the history",
    async () => {
      const reply = (id: string) => [
        sse.created(),
        ...sse.textMessage(0, id, ["Hi."]),
        sse.completed([sse.messageItem(id, "Hi.")]),
      ];
      const h = setup([reply("msg_1"), reply("msg_2")], undefined, [], async () => "Excel.");
      await h.conversation.send("Summarise it", [
        {
          id: "f1",
          sourceFilename: "report.pdf",
          chunks: [
            { type: "text", text: "Page one.", format: "plain" },
            { type: "image", base64: "AAAA" },
          ],
        },
      ]);
      await h.conversation.send("Thanks");

      const filePart = {
        type: "input_file",
        filename: "report.pdf",
        chunks: [
          { type: "input_text", text: "Page one." },
          { type: "input_image", image_url: "data:image/jpeg;base64,AAAA" },
        ],
      };
      const first = (h.requests[0].body.input as Array<{ content: unknown }>)[0];
      assert.deepEqual(first.content, [
        { type: "input_text", text: "Summarise it" },
        filePart,
        { type: "input_text", text: `${CONTEXT_PREFIX}Excel.` },
      ]);
      const later = (h.requests[1].body.input as Array<{ content: unknown }>)[0];
      assert.deepEqual(later.content, [{ type: "input_text", text: "Summarise it" }, filePart]);
      assert.ok(renderOutline(h.conversation.getState()).includes("report.pdf"), "the file name is shown");
    },
  ],
  [
    "only the newest user message carries the app context",
    async () => {
      const reply = (id: string) => [
        sse.created(),
        ...sse.textMessage(0, id, ["Hi."]),
        sse.completed([sse.messageItem(id, "Hi.")]),
      ];
      let sheet = "Sales";
      const h = setup([reply("msg_1"), reply("msg_2")], undefined, [], async () => `Excel. Active sheet: '${sheet}'.`);
      await h.conversation.send("Hello");
      sheet = "Costs";
      await h.conversation.send("And now?");

      const input = h.requests[1].body.input as Array<{ type: string; role?: string; content: unknown }>;
      const users = input.filter((item) => item.type === "message" && item.role === "user");
      assert.deepEqual(users[0].content, [{ type: "input_text", text: "Hello" }]);
      assert.deepEqual(users[1].content, [
        { type: "input_text", text: "And now?" },
        { type: "input_text", text: `${CONTEXT_PREFIX}Excel. Active sheet: 'Costs'.` },
      ]);
    },
  ],
];

async function main(): Promise<void> {
  let failed = 0;
  for (const [name, run] of cases) {
    try {
      await run();
      console.log(`PASS  ${name}`);
    } catch (error) {
      failed += 1;
      console.log(`FAIL  ${name}`);
      console.log(error);
    }
  }
  console.log(`\n${cases.length - failed}/${cases.length} fixtures passed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

void main();
