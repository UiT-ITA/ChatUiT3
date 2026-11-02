import { useTranslation } from 'react-i18next';
import { formatDuration } from '../../utils/durationUtils';
import { prettyMaybeJson } from '../../utils/jsonUtils';
import type { ActivityEntryDto, ToolCallStatus } from '../../types/chatModels';
import { isAwaitingStatus } from '../../types/chatModels';
import ToolPreview from './interaction/ToolPreview';
import "./ToolCallBlock.css";
import Badge from '../common/Badge';
import Card from '../common/Card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../common/Collapsible';
import { ListItem } from '../common/List';

type Props = {
  entry: ActivityEntryDto;
  /** Set once the call has finished, or counting up while it runs. */
  durationMs: number | null;
};

function truncateEnd(text: string, maxLen = 140): string {
  if (text.length <= maxLen) return text;
  const safeLen = Math.max(0, maxLen - 3);
  return text.slice(0, safeLen) + "...";
}

const STATUS_KEYS: Record<ToolCallStatus, string> = {
  running: 'chat.status.running',
  awaitingConfirmation: 'chat.status.awaitingConfirmation',
  awaitingAnswer: 'chat.status.awaitingAnswer',
  awaitingClient: 'chat.status.awaitingClient',
  approved: 'chat.status.approved',
  completed: 'chat.status.done',
  rejected: 'chat.status.rejected',
  unanswered: 'chat.status.unanswered',
  timeout: 'chat.status.timeout',
  error: 'chat.status.failed',
};

/**
 * One tool call in a message's activity: its name, status, and on opening what the user was
 * shown and answered, the arguments and the result. A call that waits is answered in the card
 * above the message box, not here.
 */
export default function ToolCallBlock({ entry, durationMs }: Props) {
  const { t } = useTranslation();
  const toolName = entry.toolName ?? '';
  const status: ToolCallStatus = entry.status ?? (entry.endedMs === null ? 'running' : entry.isError ? 'error' : 'completed');
  const awaiting = isAwaitingStatus(status);
  const isComplete = entry.endedMs !== null;

  const prettyArgs = prettyMaybeJson(entry.argumentsJson);
  const prettyResult = prettyMaybeJson(entry.result);
  const argsInline = entry.argumentsJson?.replace(/\s+/g, " ") ?? "";
  const argsPreview = argsInline.length > 0 ? truncateEnd(argsInline, 140) : "";
  const answers = entry.response?.kind === 'answer' ? entry.response.answers : undefined;

  const statusTone = awaiting ? "awaiting" : status === "rejected" || status === "timeout" || status === "unanswered" ? "declined" : entry.isError ? "error" : isComplete ? "complete" : "running";

  return (
    <Collapsible my="md">
      <Card padding="none" gap="none" tone={awaiting ? 'warning' : 'default'}>
        <CollapsibleTrigger>
          <ListItem
            density="compact"
            title={(
              <>
                <strong className="toolcall-name t-overline">{toolName}</strong>
                {entry.execution === 'client' && <Badge ml="xs">{t('toolCall.execution.client')}</Badge>}
                <span className="toolcall-args-inline t-meta"> ({argsPreview})</span>
              </>
            )}
            trailing={(
              <span className={`toolcall-status toolcall-status--${statusTone} t-overline`}>
                {t(status === 'rejected' && entry.questions ? 'chat.status.skipped' : STATUS_KEYS[status])}
                {durationMs !== null && !awaiting && <span className="toolcall-duration t-meta"> · {formatDuration(durationMs)}</span>}
              </span>
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="toolcall-body">
            {entry.preview && (
              <div className="toolcall-section">
                <div className="toolcall-title t-overline">{entry.preview.title}</div>
                <ToolPreview preview={entry.preview} />
              </div>
            )}
            {entry.questions && entry.questions.length > 0 && (
              <div className="toolcall-section">
                <div className="toolcall-title t-overline">{t('toolCall.questions', { count: entry.questions.length })}</div>
                {entry.questions.map((question, index) => {
                  const answer = answers === undefined ? undefined : answers?.[index] ?? null;
                  return (
                    <div key={index} className="toolcall-question">
                      <div className="t-table">{question.question}</div>
                      {answer !== undefined && (
                        <div className="toolcall-answer t-table">
                          {answer === null
                            ? t('toolCall.notAnswered')
                            : [...answer.selected, ...(answer.text ? [answer.text] : [])].join(' · ')}
                        </div>
                      )}
                    </div>
                  );
                })}
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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
