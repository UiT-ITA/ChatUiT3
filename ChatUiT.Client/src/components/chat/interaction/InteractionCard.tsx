import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../../common/Button';
import IconButton from '../../common/IconButton';
import { Icon, type IconName } from '../../common/Icon';
import TextArea from '../../common/TextArea';
import type { InteractionDock } from '../../../hooks/useInteractionDock';
import type { ToolPreviewKind } from '../../../types/chatModels';
import ToolPreview from './ToolPreview';
import { prettyMaybeJson } from '../../../utils/jsonUtils';
import './InteractionCard.css';

const KIND_ICONS: Record<ToolPreviewKind, IconName> = {
  general: 'tools',
  message: 'mail',
  file: 'file',
  documentEdit: 'edit',
  event: 'calendar',
};

function prettyJson(text: string | null): string {
  return prettyMaybeJson(text) ?? '{}';
}

function isJsonObject(text: string): boolean {
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/**
 * The approval or question the chat waits on, docked on top of the message box. The call itself
 * stays in the message's activity; this card only answers it.
 */
export default function InteractionCard({ dock }: { dock: InteractionDock }) {
  const current = dock.current;
  if (!current) {
    return null;
  }

  return (
    <section className="interaction-card" aria-label={current.kind === 'approval' ? current.preview.title : current.questions[dock.step]?.question}>
      {current.kind === 'approval'
        ? <ApprovalBody key={current.entry.toolCallId} dock={dock} />
        : <QuestionBody key={current.entry.toolCallId} dock={dock} />}
    </section>
  );
}

function Header({ icon, title, subtitle, dock, stepper }: { icon: IconName; title: string; subtitle: string; dock: InteractionDock; stepper?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="interaction-header">
      <span className="interaction-icon" aria-hidden="true">
        <Icon name={icon} size="medium" />
      </span>
      <div className="interaction-heading">
        <span className="interaction-title t-ui">{title}</span>
        <span className="interaction-subtitle t-caption">{subtitle}</span>
      </div>
      {stepper}
      {!stepper && dock.count > 1 && (
        <span className="interaction-position t-meta">{t('interaction.position', { index: dock.position, count: dock.count })}</span>
      )}
    </div>
  );
}

function ApprovalBody({ dock }: { dock: InteractionDock }) {
  const { t } = useTranslation();
  const current = dock.current!;
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(() => prettyJson(current.entry.argumentsJson));
  if (current.kind !== 'approval') {
    return null;
  }

  const allowEdit = current.source === 'server' && current.preview.allowEdit;
  const editedIsValid = !editing || isJsonObject(edited);
  const changed = editing && edited.trim() !== prettyJson(current.entry.argumentsJson).trim();

  return (
    <>
      <Header icon={KIND_ICONS[current.preview.kind] ?? 'tools'} title={current.preview.title} subtitle={t('interaction.needsApproval')} dock={dock} />
      <ToolPreview preview={current.preview} />
      {allowEdit && (
        <div className="interaction-edit">
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
      {dock.error && <div className="interaction-error t-caption" role="alert">{dock.error}</div>}
      <div className="interaction-actions">
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
        <span className="interaction-hint t-caption">{t('interaction.approvalHint')}</span>
      </div>
    </>
  );
}

function QuestionBody({ dock }: { dock: InteractionDock }) {
  const { t } = useTranslation();
  const current = dock.current!;
  if (current.kind !== 'question') {
    return null;
  }

  const count = current.questions.length;
  const question = current.questions[dock.step];
  const last = dock.step === count - 1;
  const hasOptions = question.options.length > 0;
  const answered = dock.selected.length > 0 || dock.text.trim().length > 0;
  const subtitle = !hasOptions ? t('interaction.writeAnswer') : question.multiSelect ? t('interaction.chooseAny') : t('interaction.pickOne');

  const stepper = count > 1 && (
    <div className="interaction-stepper">
      <IconButton icon="chevronLeft" label={t('interaction.previous')} size="small" disabled={dock.busy || dock.step === 0} onClick={() => dock.goTo(dock.step - 1)} />
      <span className="interaction-position t-meta">{t('interaction.questionPosition', { index: dock.step + 1, count })}</span>
      <IconButton icon="chevronRight" label={t('interaction.following')} size="small" disabled={dock.busy || last} onClick={() => dock.goTo(dock.step + 1)} />
    </div>
  );

  return (
    <>
      <Header icon="question" title={question.question} subtitle={subtitle} dock={dock} stepper={stepper} />
      {hasOptions && (
        <div className="interaction-options" role={question.multiSelect ? 'group' : 'radiogroup'} aria-label={question.question}>
          {question.options.map(option => {
            const picked = dock.selected.includes(option.label);
            return (
              <button
                key={option.label}
                type="button"
                role={question.multiSelect ? 'checkbox' : 'radio'}
                aria-checked={picked}
                className="interaction-option"
                data-picked={picked || undefined}
                disabled={dock.busy}
                onClick={() => dock.toggleOption(option.label)}
              >
                <span className={`interaction-option-mark interaction-option-mark--${question.multiSelect ? 'check' : 'radio'}`} aria-hidden="true">
                  {picked && question.multiSelect && <Icon name="check" size="small" />}
                </span>
                <span className="interaction-option-text">
                  <span className="t-ui">{option.label}</span>
                  {option.description && <span className="interaction-option-description t-caption">{option.description}</span>}
                </span>
              </button>
            );
          })}
        </div>
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
      {dock.error && <div className="interaction-error t-caption" role="alert">{dock.error}</div>}
      <div className="interaction-actions interaction-actions--end">
        <Button variant="ghost" size="small" disabled={dock.busy} onClick={() => dock.skip()}>
          {t('interaction.skip')}
        </Button>
        <Button variant="primary" size="small" loading={dock.busy} disabled={dock.busy || !answered} onClick={() => dock.next()}>
          {last ? t('interaction.send') : t('interaction.next')}
        </Button>
      </div>
    </>
  );
}
