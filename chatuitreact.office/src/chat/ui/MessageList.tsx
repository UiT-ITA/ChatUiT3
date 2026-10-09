/* global HTMLDivElement */

import { makeStyles, Spinner } from "@fluentui/react-components";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { outputText, type InputItem, type OutputItem } from "../api/types";
import {
  approvalState,
  CONTEXT_PREFIX,
  isBusy,
  type ApprovalDecision,
  type ConversationState,
  type ItemActivity,
  type Turn,
} from "../conversation/conversation";
import { ApprovalCard } from "./ApprovalCard";
import { AssistantMeta, type TurnActivity } from "./AssistantMeta";
import { Message } from "./Message";
import { hasActivity, Reasoning } from "./Reasoning";
import { ToolActivity } from "./ToolActivity";
import { color, typography } from "./tokens";

export interface MessageListProps {
  state: ConversationState;
  /** Shown while the conversation is empty. */
  emptyMessage: string;
  onAnswer(requestId: string, decision: ApprovalDecision): Promise<void>;
}

const useStyles = makeStyles({
  root: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    // Office draws its personality menu over the top-right 34x32 px of the task pane (Mac), so the
    // first message starts below it.
    padding: "2.5rem 0.875rem 1rem",
    // The list scrolls, so its items must keep their height. Without this, an item with
    // overflow: hidden (a tool call) shrinks to its borders once the list overflows.
    "& > *": { flexShrink: 0 },
  },
  empty: { ...typography.chat, color: color.text2, textAlign: "center", marginTop: "2rem" },
  status: { ...typography.caption, color: color.text3 },
});

export function MessageList({ state, emptyMessage, onAnswer }: MessageListProps) {
  const styles = useStyles();
  const listRef = useRef<HTMLDivElement>(null);
  const contentHeight = useRef(0);
  const busy = isBusy(state);

  // Keeps the newest content in view by scrolling the list itself, and only when its content grew
  // or shrank. Streamed text inside a collapsed summary changes nothing, so the chat stays still.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && list.scrollHeight !== contentHeight.current) {
      contentHeight.current = list.scrollHeight;
      list.scrollTop = list.scrollHeight;
    }
  });

  const outputs = new Map<string, string>();
  for (const item of state.items) {
    if (item.type === "function_call_output") {
      outputs.set(item.call_id, outputText(item.output));
    }
  }

  const context: RenderContext = { state, outputs, busy, onAnswer };
  const rendered: ReactNode[] = turnSegments(state).flatMap((segment) =>
    segment.turn?.endedAt != null ? renderCollapsedTurn(segment, context) : renderSegment(segment, context)
  );
  const live = state.live.filter((item) => !!item).map((item, index) => renderLiveItem(item, `live-${index}`, state));
  const showThinking = state.status === "streaming" && !live.some((node) => node !== null);

  return (
    <div ref={listRef} className={styles.root}>
      {state.items.length === 0 && <p className={styles.empty}>{emptyMessage}</p>}
      {rendered}
      {live}
      {showThinking && (
        <Spinner size="extra-tiny" label={{ children: "Thinking…", className: styles.status }} labelPosition="after" />
      )}
      {state.cancelled && <span className={styles.status}>Stopped.</span>}
    </div>
  );
}

interface RenderContext {
  state: ConversationState;
  outputs: Map<string, string>;
  busy: boolean;
  onAnswer: MessageListProps["onAnswer"];
}

/** Items `start` to `end` (exclusive). `turn` is null for items before the first turn. */
interface Segment {
  start: number;
  end: number;
  turn: Turn | null;
}

function turnSegments(state: ConversationState): Segment[] {
  const { items, turns } = state;
  const segments: Segment[] = [];
  const firstStart = turns[0]?.start ?? items.length;
  if (firstStart > 0) {
    segments.push({ start: 0, end: firstStart, turn: null });
  }
  turns.forEach((turn, index) => {
    segments.push({ start: turn.start, end: turns[index + 1]?.start ?? items.length, turn });
  });
  return segments;
}

/**
 * Reasoning items of a segment, by the item index they are shown before. A reasoning item that
 * ended a turn has the next turn's start as its position, so it belongs to the earlier turn.
 */
function thoughtsOf(state: ConversationState, segment: Segment): Map<number, string[]> {
  const byPosition = new Map<number, string[]>();
  for (const thought of state.thoughts) {
    const inside =
      (thought.position > segment.start || (segment.start === 0 && thought.position === 0)) &&
      thought.position <= segment.end;
    if (inside) {
      byPosition.set(thought.position, [...(byPosition.get(thought.position) ?? []), thought.id]);
    }
  }
  return byPosition;
}

function renderThoughts(state: ConversationState, ids: string[] | undefined): ReactNode[] {
  return (ids ?? []).map((id) => {
    const activity = state.activity[id];
    return hasActivity(activity) ? <Reasoning key={`thought-${id}`} activity={activity} /> : null;
  });
}

/** A turn that is running or waiting for an approval, or items outside any turn: shown in full. */
function renderSegment(segment: Segment, context: RenderContext): ReactNode[] {
  const thoughts = thoughtsOf(context.state, segment);
  const nodes: ReactNode[] = [];
  for (let index = segment.start; index < segment.end; index++) {
    nodes.push(...renderThoughts(context.state, thoughts.get(index)));
    nodes.push(renderItem(context.state.items[index], `item-${index}`, context));
  }
  nodes.push(...renderThoughts(context.state, thoughts.get(segment.end)));
  return nodes;
}

/**
 * A finished turn: the user's message, then the replies and approval cards. All reasoning and tool
 * activity, in order, collapses to one "Worked for <N>s" line in the assistant's meta row: the first
 * reply's, or a meta row of its own when the turn does not start with a reply.
 */
function renderCollapsedTurn(segment: Segment, context: RenderContext): ReactNode[] {
  const { state } = context;
  const thoughts = thoughtsOf(state, segment);
  const activity: ReactNode[] = [];
  // Items that show something, in order. Function call outputs and reasoning items show nothing.
  const rest: Array<{ index: number; node: ReactNode }> = [];
  for (let index = segment.start + 1; index < segment.end; index++) {
    activity.push(...renderThoughts(state, thoughts.get(index)));
    const item = state.items[index];
    const node = renderItem(item, `item-${index}`, context);
    if (item.type === "function_call" || item.type === "mcp_call") {
      activity.push(node);
    } else if (node !== null) {
      rest.push({ index, node });
    }
  }
  activity.push(...renderThoughts(state, thoughts.get(segment.end)));

  const turn = segment.turn as Turn;
  const seconds = Math.max(0, Math.round(((turn.endedAt ?? turn.startedAt) - turn.startedAt) / 1000));
  const shown = activity.filter((node) => node !== null);
  const turnActivity: TurnActivity | undefined = shown.length > 0 ? { seconds, children: shown } : undefined;

  const first = rest.length > 0 ? state.items[rest[0].index] : undefined;
  const reply = first?.type === "message" && first.role === "assistant" ? first : undefined;
  const nodes: ReactNode[] = [renderItem(state.items[segment.start], `item-${segment.start}`, context)];
  if (turnActivity && !reply) {
    nodes.push(<AssistantMeta key={`meta-${segment.start}`} activity={turnActivity} />);
  }
  rest.forEach(({ index, node }, position) => {
    nodes.push(
      position === 0 && reply && turnActivity ? (
        <Message
          key={`item-${index}`}
          role="assistant"
          text={messageText(reply.content)}
          meta={<AssistantMeta activity={turnActivity} />}
        />
      ) : (
        node
      )
    );
  });
  return nodes;
}

function renderItem(item: InputItem, key: string, context: RenderContext): ReactNode {
  const { state, outputs, busy, onAnswer } = context;
  switch (item.type) {
    case "message":
      if (item.role !== "user" && item.role !== "assistant") {
        return null;
      }
      return <Message key={key} role={item.role} text={messageText(item.content)} files={fileNames(item.content)} />;
    case "function_call": {
      const output = outputs.get(item.call_id);
      const status = output === undefined ? "running" : isErrorOutput(output) ? "failed" : "done";
      return <ToolActivity key={key} name={item.name} status={status} />;
    }
    case "mcp_call":
      return (
        <ToolActivity
          key={key}
          name={item.name}
          status={item.error ? "failed" : "done"}
          activity={activityOf(state, item.id)}
        />
      );
    case "mcp_approval_request":
      return (
        <ApprovalCard
          key={key}
          request={item}
          state={approvalState(state.items, item)}
          disabled={busy}
          onAnswer={(decision) => onAnswer(item.id, decision)}
        />
      );
    default:
      // Reasoning items are shown from `state.thoughts`.
      return null;
  }
}

function renderLiveItem(item: OutputItem, key: string, state: ConversationState): ReactNode {
  switch (item.type) {
    case "message": {
      const text = messageText(item.content);
      return text ? <Message key={key} role="assistant" text={text} /> : null;
    }
    case "reasoning": {
      const activity = state.activity[item.id];
      return hasActivity(activity) ? <Reasoning key={key} activity={activity} /> : null;
    }
    case "function_call":
      return <ToolActivity key={key} name={item.name} status="running" />;
    case "mcp_call": {
      const failed = item.status === "failed" || !!item.error;
      const running = item.status === "in_progress" && typeof item.output !== "string";
      return (
        <ToolActivity
          key={key}
          name={item.name}
          status={failed ? "failed" : running ? "running" : "done"}
          activity={activityOf(state, item.id)}
        />
      );
    }
    default:
      return null;
  }
}

function activityOf(state: ConversationState, id: string): ItemActivity | undefined {
  const activity = state.activity[id];
  return hasActivity(activity) ? activity : undefined;
}

/** The text of a message, without the app context the pane sends after the user's text. */
function messageText(content: string | ReadonlyArray<{ type: string; text?: string }>): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((part) => part.type === "output_text" || part.type === "input_text")
    .filter((part) => !part.text?.startsWith(CONTEXT_PREFIX))
    .map((part) => part.text ?? "")
    .join("");
}

/** The names of the files attached to a message. */
function fileNames(content: string | ReadonlyArray<{ type: string; filename?: string }>): string[] {
  return typeof content === "string"
    ? []
    : content.flatMap((part) => (part.type === "input_file" && part.filename ? [part.filename] : []));
}

function isErrorOutput(output: string): boolean {
  try {
    const value: unknown = JSON.parse(output);
    return typeof value === "object" && value !== null && "error" in value;
  } catch {
    return false;
  }
}
