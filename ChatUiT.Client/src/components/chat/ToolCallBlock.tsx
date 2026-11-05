import { useTranslation } from 'react-i18next';
import { formatDuration } from '../../utils/durationUtils';
import { prettyMaybeJson } from '../../utils/jsonUtils';
import type { ActivityEntryDto, ToolCallStatus } from '../../types/chatModels';
import { isAwaitingStatus } from '../../types/chatModels';
import ToolPreview from './interaction/ToolPreview';
import Badge from '../common/Badge';
import Box from '../common/Box';
import Card from '../common/Card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../common/Collapsible';
import { ListItem } from '../common/List';
import Stack from '../common/Stack';
import Text, { type TextTone } from '../common/Text';

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

/** A part of an opened tool call: an overline title over its content. */
function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <Box mt="sm">
      <Text as="div" variant="overline" tone="muted" mb="xs">{title}</Text>
      {children}
    </Box>
  );
}

/** Preformatted code text, such as the arguments or the result of a call. */
function CodeText({ children }: { children: React.ReactNode }) {
  return <Text as="pre" variant="code" tone="secondary" p="sm" surface="code" border="soft" radius="sm" wrap="pre" breakWord>{children}</Text>;
}

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
          <Box pt="sm" px="md" pb="md" border borderSide="top">
            {entry.preview && (
              <Section title={entry.preview.title}>
                <ToolPreview preview={entry.preview} />
              </Section>
            )}
            {entry.questions && entry.questions.length > 0 && (
              <Section title={t('toolCall.questions', { count: entry.questions.length })}>
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
              </Section>
            )}
            {prettyArgs && (
              <Section title={t('toolCall.arguments')}>
                <CodeText>{prettyArgs}</CodeText>
              </Section>
            )}
            {prettyResult && (
              <Section title={t('toolCall.result')}>
                <CodeText>{prettyResult}</CodeText>
              </Section>
            )}
          </Box>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
