import { useTranslation } from 'react-i18next';
import { formatDuration } from '../../utils/durationUtils';
import type { ActivityEntryDto, ToolCallStatus } from '../../types/chatModels';
import { isAwaitingStatus } from '../../types/chatModels';
import ToolConfirmationCard from './ToolConfirmationCard';
import "./ToolCallBlock.css";

type Props = {
  entry: ActivityEntryDto;
  /** Set once the call has finished, or counting up while it runs. */
  durationMs: number | null;
  /** True while the message is still generating; only then can the user act on the call. */
  isLive: boolean;
  chatId: string | null;
  messageId: string;
  /** Server time (ms since generation start) when the pending call times out. */
  deadlineMs: number | null;
  /** Current server-side elapsed time while live. */
  nowMs: number | null;
};

function prettyMaybeJson(text: string | null): string | undefined {
  if (!text) return undefined;
  const t = text.trim();
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.stringify(JSON.parse(t), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

function truncateEnd(text: string, maxLen = 140): string {
  if (text.length <= maxLen) return text;
  const safeLen = Math.max(0, maxLen - 3);
  return text.slice(0, safeLen) + "...";
}

const STATUS_KEYS: Record<ToolCallStatus, string> = {
  running: 'chat.status.running',
  awaitingConfirmation: 'chat.status.awaitingConfirmation',
  awaitingClient: 'chat.status.awaitingClient',
  approved: 'chat.status.approved',
  completed: 'chat.status.done',
  rejected: 'chat.status.rejected',
  timeout: 'chat.status.timeout',
  error: 'chat.status.failed',
};

export default function ToolCallBlock({ entry, durationMs, isLive, chatId, messageId, deadlineMs, nowMs }: Props) {
  const { t } = useTranslation();
  const toolName = entry.toolName ?? '';
  const status: ToolCallStatus = entry.status ?? (entry.endedMs === null ? 'running' : entry.isError ? 'error' : 'completed');
  const awaiting = isAwaitingStatus(status);
  const needsUser = isLive && entry.endedMs === null && status === 'awaitingConfirmation';
  const isComplete = entry.endedMs !== null;

  const prettyArgs = prettyMaybeJson(entry.argumentsJson);
  const prettyResult = prettyMaybeJson(entry.result);
  const argsInline = entry.argumentsJson?.replace(/\s+/g, " ") ?? "";
  const argsPreview = argsInline.length > 0 ? truncateEnd(argsInline, 140) : "";

  const remainingMs = deadlineMs !== null && nowMs !== null ? deadlineMs - nowMs : null;

  const stateClass = isComplete ? "complete" : "running";
  const statusClass = awaiting ? "awaiting" : status === "rejected" || status === "timeout" ? "declined" : entry.isError ? "error" : "";

  return (
    <details className={`toolcall ${stateClass} ${statusClass}`} open={needsUser || undefined}>
      <summary className="toolcall-summary t-ui-plain">
        <span className="toolcall-title-clip">
          <strong className="toolcall-name t-overline">{toolName}</strong>
          {entry.execution === 'client' && <span className="toolcall-badge t-meta">{t('toolCall.execution.client')}</span>}
          <span className="toolcall-args-inline t-meta">({argsPreview})</span>
        </span>
        <span className="toolcall-status t-overline">
          {t(STATUS_KEYS[status])}
          {durationMs !== null && !awaiting && <span className="toolcall-duration t-meta"> · {formatDuration(durationMs)}</span>}
        </span>
      </summary>
      <div className="toolcall-body">
        {needsUser && status === 'awaitingConfirmation' && entry.preview && entry.toolCallId && (
          <ToolConfirmationCard
            chatId={chatId}
            messageId={messageId}
            toolCallId={entry.toolCallId}
            preview={entry.preview}
            argumentsJson={entry.argumentsJson}
            remainingMs={remainingMs}
          />
        )}
        {!needsUser && entry.preview && (
          <div className="toolcall-section">
            <div className="toolcall-title t-overline">{entry.preview.title}</div>
            <dl className="toolcard-fields">
              {entry.preview.fields.map((field, index) => (
                <div key={index} className="toolcard-field">
                  <dt className="t-overline">{field.label}</dt>
                  <dd className={field.multiline ? 't-code toolcard-multiline' : 't-table'}>{field.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {prettyArgs && (
          <div className="toolcall-section">
            <div className="toolcall-title t-overline">{t('toolCall.arguments')}</div>
            <pre className="toolcall-pre t-code">{prettyArgs}</pre>
          </div>
        )}
        {prettyResult && (
          <div className="toolcall-section">
            <div className="toolcall-title t-overline">{t('toolCall.result')}</div>
            <pre className="toolcall-pre t-code">{prettyResult}</pre>
          </div>
        )}
      </div>
    </details>
  );
}
