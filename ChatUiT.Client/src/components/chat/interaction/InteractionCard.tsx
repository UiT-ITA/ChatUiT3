import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../common/Button';
import IconButton from '../../common/IconButton';
import type { IconName } from '../../common/Icon';
import IconTile from '../../common/IconTile';
import ChoiceOption from '../../common/ChoiceOption';
import Stack from '../../common/Stack';
import Text from '../../common/Text';
import TextArea from '../../common/TextArea';
import type { InteractionDock } from '../../../hooks/useInteractionDock';
import type { ToolPreviewKind } from '../../../types/chatModels';
import ToolPreview from './ToolPreview';
import { prettyMaybeJson } from '../../../utils/jsonUtils';

const KIND_ICONS: Record<ToolPreviewKind, IconName> = {
  general: 'tools',
  message: 'mail',
  file: 'file',
  documentEdit: 'edit',
  event: 'calendar',
};

const prettyJson = (text: string | null) => prettyMaybeJson(text) ?? '{}';

function isJsonObject(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/** The approval or question the chat waits on, with its answer controls, docked on top of the message box. */
export default function InteractionCard({ dock }: { dock: InteractionDock }) {
  const current = dock.current;
  if (!current) return null;

  return (
    <Stack
      as="section"
      gap="md"
      maxHeight="half-screen"
      overflow="y-auto"
      py="lg"
      px="lg"
      border
      borderSide="bottom"
      aria-label={current.kind === 'approval' ? current.preview.title : current.questions[dock.step]?.question}
    >
      {current.kind === 'approval'
        ? <ApprovalBody key={current.entry.toolCallId} dock={dock} />
        : <QuestionBody key={current.entry.toolCallId} dock={dock} />}
    </Stack>
  );
}

function Header({ icon, title, subtitle, dock, stepper }: { icon: IconName; title: string; subtitle: string; dock: InteractionDock; stepper?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" align="center" gap="md">
      <IconTile icon={icon} />
      <Stack gap="none" grow>
        <Text variant="ui" tone="default" breakWord>{title}</Text>
        <Text variant="caption" tone="muted">{subtitle}</Text>
      </Stack>
      {stepper}
      {!stepper && dock.count > 1 && (
        <Text variant="meta" tone="muted" wrap="nowrap" shrink={false}>{t('interaction.position', { index: dock.position, count: dock.count })}</Text>
      )}
    </Stack>
  );
}

function ApprovalBody({ dock }: { dock: InteractionDock }) {
  const { t } = useTranslation();
  const current = dock.current!;
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(() => prettyJson(current.entry.argumentsJson));
  if (current.kind !== 'approval') return null;

  const allowEdit = current.source === 'server' && current.preview.allowEdit;
  const editedIsValid = !editing || isJsonObject(edited);
  const changed = editing && edited.trim() !== prettyJson(current.entry.argumentsJson).trim();

  return (
    <>
      <Header icon={KIND_ICONS[current.preview.kind] ?? 'tools'} title={current.preview.title} subtitle={t('interaction.needsApproval')} dock={dock} />
      <ToolPreview preview={current.preview} />
      {allowEdit && (
        <div>
          <Button variant="ghost" size="small" onClick={() => setEditing(value => !value)} disabled={dock.busy}>
            {editing ? t('interaction.hideArguments') : t('interaction.editArguments')}
          </Button>
          {editing && (
            <TextArea
              monospace
              error={editedIsValid ? undefined : t('interaction.invalidJson')}
              mt="sm"
              value={edited}
              onChange={value => setEdited(value)}
              rows={Math.min(16, Math.max(4, edited.split('\n').length))}
              spellCheck={false}
              disabled={dock.busy}
            />
          )}
        </div>
      )}
      {dock.error && <Text as="div" variant="caption" tone="danger" role="alert">{dock.error}</Text>}
      <Stack direction="row" wrap align="center" gap="sm">
        <Button
          variant="primary"
          size="small"
          startIcon="check"
          loading={dock.busy}
          disabled={dock.busy || !editedIsValid}
          onClick={() => dock.approve(changed ? edited : null)}
        >
          {t('interaction.approve')}
        </Button>
        <Button variant="secondary" size="small" startIcon="close" disabled={dock.busy} onClick={() => dock.reject()}>
          {t('interaction.reject')}
        </Button>
        <Text variant="caption" tone="muted" ml="xs">{t('interaction.approvalHint')}</Text>
      </Stack>
    </>
  );
}

function QuestionBody({ dock }: { dock: InteractionDock }) {
  const { t } = useTranslation();
  const current = dock.current!;
  if (current.kind !== 'question') return null;

  const count = current.questions.length;
  const question = current.questions[dock.step];
  const last = dock.step === count - 1;
  const hasOptions = question.options.length > 0;
  const answered = dock.selected.length > 0 || dock.text.trim().length > 0;
  const subtitle = !hasOptions ? t('interaction.writeAnswer') : question.multiSelect ? t('interaction.chooseAny') : t('interaction.pickOne');

  const stepper = count > 1 && (
    <Stack direction="row" align="center" gap="xs" shrink={false}>
      <IconButton icon="chevronLeft" label={t('interaction.previous')} size="small" disabled={dock.busy || dock.step === 0} onClick={() => dock.goTo(dock.step - 1)} />
      <Text variant="meta" tone="muted" wrap="nowrap" shrink={false}>{t('interaction.questionPosition', { index: dock.step + 1, count })}</Text>
      <IconButton icon="chevronRight" label={t('interaction.following')} size="small" disabled={dock.busy || last} onClick={() => dock.goTo(dock.step + 1)} />
    </Stack>
  );

  return (
    <>
      <Header icon="question" title={question.question} subtitle={subtitle} dock={dock} stepper={stepper} />
      {hasOptions && (
        <Stack gap="sm" role={question.multiSelect ? 'group' : 'radiogroup'} aria-label={question.question}>
          {question.options.map(option => (
            <ChoiceOption
              key={option.label}
              mode={question.multiSelect ? 'check' : 'radio'}
              picked={dock.selected.includes(option.label)}
              label={option.label}
              description={option.description}
              disabled={dock.busy}
              onClick={() => dock.toggleOption(option.label)}
            />
          ))}
        </Stack>
      )}
      <TextArea
        key={dock.step}
        aria-label={hasOptions ? t('interaction.ownAnswer') : question.question}
        placeholder={hasOptions ? t('interaction.ownAnswerPlaceholder') : t('interaction.answerPlaceholder')}
        value={dock.text}
        onChange={value => dock.setText(value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey && answered && !dock.busy) {
            event.preventDefault();
            void dock.next();
          }
        }}
        autoResize
        minRows={1}
        maxRows={6}
        disabled={dock.busy}
      />
      {dock.error && <Text as="div" variant="caption" tone="danger" role="alert">{dock.error}</Text>}
      <Stack direction="row" wrap align="center" justify="end" gap="sm">
        <Button variant="ghost" size="small" disabled={dock.busy} onClick={() => dock.skip()}>
          {t('interaction.skip')}
        </Button>
        <Button variant="primary" size="small" loading={dock.busy} disabled={dock.busy || !answered} onClick={() => dock.next()}>
          {last ? t('interaction.send') : t('interaction.next')}
        </Button>
      </Stack>
    </>
  );
}
