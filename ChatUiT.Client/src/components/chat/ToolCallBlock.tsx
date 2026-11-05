import { useTranslation } from 'react-i18next';
import { formatDuration } from '../../utils/durationUtils';
import { prettyMaybeJson } from '../../utils/jsonUtils';
import type { ActivityEntryDto, ToolCallStatus } from '../../types/chatModels';
import { isAwaitingStatus } from '../../types/chatModels';
import ToolPreview from './interaction/ToolPreview';
import Badge from '../common/Badge';
import Card from '../common/Card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../common/Collapsible';
import { ListItem } from '../common/List';
import Stack from '../common/Stack';
import Text, { type TextTone } from '../common/Text';
import TextBlock from '../common/TextBlock';

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
 * One tool call in a message's activity: its name and status, and when opened what the user was
 * shown and answered, the arguments and the result.
 */
export default function ToolCallBlock({ entry, durationMs }: { entry: ActivityEntryDto; durationMs: number | null }) {
  const { t } = useTranslation();
  const toolName = entry.toolName ?? '';
  const status: ToolCallStatus = entry.status ?? (entry.endedMs === null ? 'running' : entry.isError ? 'error' : 'completed');
  const awaiting = isAwaitingStatus(status);
  const isComplete = entry.endedMs !== null;

  const prettyArgs = prettyMaybeJson(entry.argumentsJson);
  const prettyResult = prettyMaybeJson(entry.result);
  const argsInline = entry.argumentsJson?.replace(/\s+/g, " ") ?? "";
  const argsPreview = argsInline.length > 140 ? argsInline.slice(0, 137) + "..." : argsInline;
  const answers = entry.response?.kind === 'answer' ? entry.response.answers : undefined;

  // Later checks take priority
  let statusTone: TextTone = isComplete ? "success" : "warning";
  if (entry.isError) statusTone = "danger";
  if (status === "rejected" || status === "timeout" || status === "unanswered") statusTone = "muted";
  if (awaiting) statusTone = "warning";

  return (
    <Collapsible my="md">
      <Card padding="none" gap="none" tone={awaiting ? 'warning' : 'default'}>
        <CollapsibleTrigger>
          <ListItem
            density="compact"
            title={(
              <>
                <Text as="strong" variant="overline" tone="muted">{toolName}</Text>
                {entry.execution === 'client' && <Badge ml="xs">{t('toolCall.execution.client')}</Badge>}
                <Text variant="meta" tone="secondary"> ({argsPreview})</Text>
              </>
            )}
            trailing={(
              <Text variant="overline" tone={statusTone}>
                {t(status === 'rejected' && entry.questions ? 'chat.status.skipped' : STATUS_KEYS[status])}
                {durationMs !== null && !awaiting && <Text variant="meta" tone="muted" plainCase> · {formatDuration(durationMs)}</Text>}
              </Text>
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Stack gap="sm" p="md" border borderSide="top">
            {entry.preview && (
              <Stack gap="xs">
                <Text as="div" variant="overline" tone="muted">{entry.preview.title}</Text>
                <ToolPreview preview={entry.preview} />
              </Stack>
            )}
            {entry.questions && entry.questions.length > 0 && (
              <Stack gap="xs">
                <Text as="div" variant="overline" tone="muted">{t('toolCall.questions', { count: entry.questions.length })}</Text>
                <Stack gap="sm">
                  {entry.questions.map((question, index) => {
                    const answer = answers === undefined ? undefined : answers?.[index] ?? null;
                    return (
                      <div key={index}>
                        <Text as="div" variant="table">{question.question}</Text>
                        {answer !== undefined && (
                          <Text as="div" variant="table" tone="secondary" mt="xs" pl="sm" border borderWidth="md" borderSide="left">
                            {answer === null
                              ? t('toolCall.notAnswered')
                              : [...answer.selected, ...(answer.text ? [answer.text] : [])].join(' · ')}
                          </Text>
                        )}
                      </div>
                    );
                  })}
                </Stack>
              </Stack>
            )}
            {prettyArgs && (
              <Stack gap="xs">
                <Text as="div" variant="overline" tone="muted">{t('toolCall.arguments')}</Text>
                <TextBlock monospace>{prettyArgs}</TextBlock>
              </Stack>
            )}
            {prettyResult && (
              <Stack gap="xs">
                <Text as="div" variant="overline" tone="muted">{t('toolCall.result')}</Text>
                <TextBlock monospace>{prettyResult}</TextBlock>
              </Stack>
            )}
          </Stack>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
