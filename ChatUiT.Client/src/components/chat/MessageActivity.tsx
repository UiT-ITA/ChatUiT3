import './MessageActivity.css';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from '../common/Icon';
import ToolCallBlock from './ToolCallBlock';
import type { LiveActivity } from '../../services/chatService';
import type { ActivityEntryDto, MessageActivityDto } from '../../types/chatModels';
import { formatDuration } from '../../utils/durationUtils';
import Button from '../common/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../common/Collapsible';

type Props = {
  /** The stored summary of a finished message. */
  activity: MessageActivityDto | null;
  /** The in-progress state while the message is generating. */
  live: LiveActivity | null;
  chatId: string;
  messageId: string;
  /** The assistant name and timestamp; the activity headline is placed after them on the same line. */
  children: ReactNode;
};

/**
 * The assistant's meta row: name, time, and "Thought for 5 s · 2 tool calls · 14 s" for what
 * happened while the message was generated. While the model thinks, the headline shows the
 * latest thinking heading. The history is collapsed until the user opens it.
 */
export default function MessageActivity({ activity, live, chatId, messageId, children }: Props) {
  const { t } = useTranslation();
  const isLive = live !== null && live.phase !== "done";
  const needsInput = isLive && live.phase === "awaitingUser";
  const [open, setOpen] = useState(needsInput);

  // Opens once when a tool asks for the user; never closes on its own.
  const [sawNeedsInput, setSawNeedsInput] = useState(needsInput);
  if (needsInput !== sawNeedsInput) {
    setSawNeedsInput(needsInput);
    if (needsInput) setOpen(true);
  }

  const entries = isLive ? live.entries : (live?.final ?? activity)?.entries ?? [];
  const summary = isLive ? null : (live?.final ?? activity);
  const liveElapsedMs = useLiveElapsed(isLive ? live : null);
  const hasActivity = isLive || summary !== null;

  const thinkingCount = entries.filter(entry => entry.type === "Thinking").length;
  const toolCount = entries.filter(entry => entry.type === "Tool").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} width="full" minWidth="0">
      <div className={`activity ${isLive ? "live" : ""} ${needsInput ? "needs-input" : ""}`}>
        <div className="message-meta">
          {children}
          {hasActivity && (
            <CollapsibleTrigger>
              <Button
                variant="ghost"
                size="xs"
                tone={needsInput ? 'warning' : 'default'}
                startIcon={<Icon name={needsInput ? "info" : isLive ? "refresh" : "branch"} size="small" spin={isLive && !needsInput} />}
              >
                {isLive ? liveHeadline(live, liveElapsedMs, t) : doneHeadline(summary!, thinkingCount, toolCount, t)}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>
        {hasActivity && (
          <CollapsibleContent>
            <div className="activity-body">
              {summary && (
                <div className="activity-facts t-meta">
                  <span>{t('chat.activity.model')}: {summary.model}</span>
                  {summary.effort !== "None" && (
                    <span>{t('chat.activity.effort')}: {t(`assistants.form.reasoningLevels.${summary.effort.toLowerCase()}`)}</span>
                  )}
                  {summary.toolRounds > 0 && <span>{t('chat.activity.rounds', { count: summary.toolRounds })}</span>}
                </div>
              )}
              {entries.length === 0 && !isLive && (
                <div className="activity-empty t-caption">{t('chat.activity.nothingRecorded')}</div>
              )}
              {entries.map((entry, index) => (
                <ActivityRow
                  key={entry.toolCallId ?? index}
                  entry={entry}
                  nowMs={isLive ? liveElapsedMs : null}
                  isLive={isLive}
                  chatId={live?.chatId ?? chatId}
                  messageId={messageId}
                  deadlineMs={isLive && live.pendingToolCallId === entry.toolCallId ? live.pendingDeadlineMs : null}
                />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

type RowProps = {
  entry: ActivityEntryDto;
  nowMs: number | null;
  isLive: boolean;
  chatId: string;
  messageId: string;
  deadlineMs: number | null;
};

function ActivityRow({ entry, nowMs, isLive, chatId, messageId, deadlineMs }: RowProps) {
  const { t } = useTranslation();
  const durationMs = entry.endedMs !== null
    ? entry.endedMs - entry.startedMs
    : nowMs !== null
      ? nowMs - entry.startedMs
      : null;

  if (entry.type === "Tool") {
    return (
      <ToolCallBlock
        entry={entry}
        durationMs={durationMs}
        isLive={isLive}
        chatId={chatId}
        messageId={messageId}
        deadlineMs={deadlineMs}
        nowMs={nowMs}
      />
    );
  }

  return (
    <div className="activity-thinking">
      <div className="activity-thinking-label t-overline">
        {t('chat.activity.thinking')}
        {durationMs !== null && <span className="t-meta"> · {formatDuration(durationMs)}</span>}
      </div>
      <div className="activity-thinking-text">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.text ?? ""}</ReactMarkdown>
      </div>
    </div>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

function liveHeadline(live: LiveActivity, elapsedMs: number, t: Translate): string {
  const phaseMs = Math.max(0, elapsedMs - live.phaseStartedMs);
  switch (live.phase) {
    case "thinking": {
      const current = live.entries[live.entries.length - 1];
      const heading = current?.type === "Thinking" ? thinkingHeading(current.text ?? "") : null;
      return `${heading ?? t('chat.activity.thinkingNow')} ${formatDuration(phaseMs)}`;
    }
    case "tool": {
      const running = [...live.entries].reverse().find(entry => entry.type === "Tool" && entry.endedMs === null);
      const key = running?.status === "awaitingClient" ? 'chat.activity.awaitingClient' : 'chat.activity.runningTool';
      return `${t(key, { name: running?.toolName ?? "" })} ${formatDuration(phaseMs)}`;
    }
    case "awaitingUser": {
      const pending = live.entries.find(entry => entry.type === "Tool" && entry.toolCallId === live.pendingToolCallId)
        ?? [...live.entries].reverse().find(entry => entry.type === "Tool" && entry.endedMs === null);
      const left = live.pendingDeadlineMs !== null
        ? ` · ${t('chat.activity.timeLeft', { duration: formatDuration(Math.max(0, live.pendingDeadlineMs - elapsedMs)) })}`
        : '';
      return `${t('chat.activity.awaitingUser', { name: pending?.toolName ?? "" })}${left}`;
    }
    case "writing":
      return t('chat.activity.writing');
    case "starting":
    case "done":
      return `${t('chat.activity.starting')} ${formatDuration(elapsedMs)}`;
    default: {
      const _exhaustive: never = live.phase;
      return _exhaustive;
    }
  }
}

const MAX_HEADING_LENGTH = 80;

/**
 * The heading of the thinking that is streaming in. Reasoning summaries arrive as paragraphs,
 * often opening with a bold or hashed title line. The latest title wins; without one, the
 * first line of the latest paragraph is used. Null while nothing readable has arrived.
 */
function thinkingHeading(text: string): string | null {
  const paragraphs = text.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    return null;
  }
  const isTitle = (line: string) => /^(#{1,6}\s+\S|\*\*[^*]+\*\*$)/.test(line);
  const titled = [...paragraphs].reverse().find(paragraph => isTitle(paragraph.split("\n")[0].trim()));
  const source = titled ?? paragraphs[paragraphs.length - 1];
  const line = source.split("\n")[0].trim().replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim();
  if (line.length === 0) {
    return null;
  }
  return line.length > MAX_HEADING_LENGTH ? `${line.slice(0, MAX_HEADING_LENGTH - 1).trimEnd()}…` : line;
}

function doneHeadline(summary: MessageActivityDto, thinkingCount: number, toolCount: number, t: Translate): string {
  const parts: string[] = [];
  if (thinkingCount > 0 && summary.thinkingMs > 0) {
    parts.push(t('chat.activity.thoughtFor', { duration: formatDuration(summary.thinkingMs) }));
  }
  if (toolCount > 0) {
    parts.push(t('chat.activity.toolCalls', { count: toolCount }));
  }
  if (parts.length === 0) {
    return t('chat.activity.generatedIn', { duration: formatDuration(summary.totalMs) });
  }
  parts.push(formatDuration(summary.totalMs));
  return parts.join(' · ');
}

/**
 * Server time is only known at each chunk. Between chunks the counter keeps moving from the
 * last known point using the local clock, so a long tool call still visibly counts up.
 */
function useLiveElapsed(live: LiveActivity | null): number {
  const [now, setNow] = useState<number | null>(null);
  const isLive = live !== null;

  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [isLive]);

  if (!live) return 0;
  const drift = now === null ? 0 : Math.max(0, now - live.receivedAt);
  return live.lastElapsedMs + drift;
}
