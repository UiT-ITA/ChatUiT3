import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Icon } from '../common/Icon';
import ToolCallBlock from './ToolCallBlock';
import type { LiveActivity } from '../../services/chatService';
import { isAwaitingStatus, type ActivityEntryDto, type MessageActivityDto } from '../../types/chatModels';
import { formatDuration } from '../../utils/durationUtils';
import Box from '../common/Box';
import Button from '../common/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../common/Collapsible';
import RichText from '../common/RichText';
import Stack from '../common/Stack';
import Text from '../common/Text';

type Props = {
  /** The stored summary of a finished message. */
  activity: MessageActivityDto | null;
  /** The in-progress state while the message is generating. */
  live: LiveActivity | null;
  /** The assistant name and timestamp; the activity headline is placed after them on the same line. */
  children: ReactNode;
};

/**
 * The assistant's meta row: name, time, and "Thought for 5 s · 2 tool calls · 14 s" for what
 * happened while the message was generated. While the model thinks, the headline shows the
 * latest thinking heading. The history is collapsed until the user opens it.
 */
export default function MessageActivity({ activity, live, children }: Props) {
  const { t } = useTranslation();
  const isLive = live !== null && live.phase !== "done";
  const [open, setOpen] = useState(false);

  const entries = isLive ? live.entries : (live?.final ?? activity)?.entries ?? [];
  const summary = isLive ? null : (live?.final ?? activity);
  // The call the message waits on
  const waitingOn = isLive ? undefined : entries.find(entry => entry.type === "Tool" && isAwaitingStatus(entry.status));
  const liveElapsedMs = useLiveElapsed(isLive ? live : null);
  const hasActivity = isLive || summary !== null;

  const thinkingCount = entries.filter(entry => entry.type === "Thinking").length;
  const toolCount = entries.filter(entry => entry.type === "Tool").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} width="full" minWidth="0">
      <Stack direction="row" align="center" gap="md" mb={hasActivity && open ? 'xs' : 'sm'}>
        {children}
        {hasActivity && (
          <CollapsibleTrigger>
            <Button
              variant="ghost"
              size="xs"
              tone={waitingOn ? 'warning' : 'default'}
              startIcon={<Icon name={waitingOn ? "info" : isLive ? "refresh" : "branch"} size="sm" spin={isLive} />}
            >
              {isLive
                ? liveHeadline(live, liveElapsedMs, t)
                : waitingOn
                  ? t('chat.activity.awaitingUser', { name: waitingOn.toolName ?? "" })
                  : doneHeadline(summary!, thinkingCount, toolCount, t)}
            </Button>
          </CollapsibleTrigger>
        )}
      </Stack>
      {hasActivity && (
        <CollapsibleContent>
          <Box mb="sm" ml="sm" py="xs" pl="md" border borderWidth="md" borderSide="left">
            {summary && (
              <Stack direction="row" wrap rowGap="xs" columnGap="lg" mb="sm">
                <Text variant="meta" tone="muted">{t('chat.activity.model')}: {summary.model}</Text>
                {summary.effort !== "None" && (
                  <Text variant="meta" tone="muted">{t('chat.activity.effort')}: {t(`assistants.form.reasoningLevels.${summary.effort.toLowerCase()}`)}</Text>
                )}
                {summary.toolRounds > 0 && <Text variant="meta" tone="muted">{t('chat.activity.rounds', { count: summary.toolRounds })}</Text>}
              </Stack>
            )}
            {entries.length === 0 && !isLive && (
              <Text as="div" variant="caption" tone="muted">{t('chat.activity.nothingRecorded')}</Text>
            )}
            {entries.map((entry, index) => (
              <ActivityRow
                key={entry.toolCallId ?? index}
                entry={entry}
                nowMs={isLive ? liveElapsedMs : null}
              />
            ))}
          </Box>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

function ActivityRow({ entry, nowMs }: { entry: ActivityEntryDto; nowMs: number | null }) {
  const { t } = useTranslation();
  const durationMs = entry.endedMs !== null
    ? entry.endedMs - entry.startedMs
    : nowMs !== null
      ? nowMs - entry.startedMs
      : null;

  if (entry.type === "Tool") {
    return <ToolCallBlock entry={entry} durationMs={durationMs} />;
  }

  return (
    <Box my="sm">
      <Text as="div" variant="overline" tone="muted" mb="xs">
        {t('chat.activity.thinking')}
        {durationMs !== null && <Text variant="meta" plainCase> · {formatDuration(durationMs)}</Text>}
      </Text>
      <RichText variant="notes">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.text ?? ""}</ReactMarkdown>
      </RichText>
    </Box>
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
    case "writing":
      return t('chat.activity.writing');
    case "starting":
    case "done":
      return `${t('chat.activity.starting')} ${formatDuration(elapsedMs)}`;
  }
}

const MAX_HEADING_LENGTH = 80;

/**
 * The heading of the thinking that is streaming in: the latest paragraph that opens with a bold
 * or hashed title line, or else the first line of the latest paragraph. Null while the text has
 * no readable line.
 */
function thinkingHeading(text: string): string | null {
  const paragraphs = text.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;
  const isTitle = (line: string) => /^(#{1,6}\s+\S|\*\*[^*]+\*\*$)/.test(line);
  const titled = [...paragraphs].reverse().find(paragraph => isTitle(paragraph.split("\n")[0].trim()));
  const source = titled ?? paragraphs[paragraphs.length - 1];
  const line = source.split("\n")[0].trim().replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim();
  if (line.length === 0) return null;
  return line.length > MAX_HEADING_LENGTH ? `${line.slice(0, MAX_HEADING_LENGTH - 1).trimEnd()}…` : line;
}

function doneHeadline(summary: MessageActivityDto, thinkingCount: number, toolCount: number, t: Translate): string {
  const parts: string[] = [];
  if (thinkingCount > 0 && summary.thinkingMs > 0) parts.push(t('chat.activity.thoughtFor', { duration: formatDuration(summary.thinkingMs) }));
  if (toolCount > 0) parts.push(t('chat.activity.toolCalls', { count: toolCount }));
  if (parts.length === 0) return t('chat.activity.generatedIn', { duration: formatDuration(summary.totalMs) });
  return [...parts, formatDuration(summary.totalMs)].join(' · ');
}

/**
 * The elapsed time of a live message: the server time of the last chunk plus the local time
 * since that chunk arrived, updated every half second.
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
