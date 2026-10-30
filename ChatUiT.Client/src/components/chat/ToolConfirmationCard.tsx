import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ToolPreviewDto } from '../../types/chatModels';
import { useToolCallActions } from '../../hooks/useToolCallActions';
import { formatDuration } from '../../utils/durationUtils';
import TextArea from '../common/TextArea';
import Button from '../common/Button';
import Card from '../common/Card';

type Props = {
  chatId: string | null;
  messageId: string;
  toolCallId: string;
  preview: ToolPreviewDto;
  argumentsJson: string | null;
  /** Milliseconds left before the server gives up, or null when unknown. */
  remainingMs: number | null;
};

function prettyJson(text: string | null): string {
  if (!text) return '{}';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** The approve / reject card for a tool that must not run without the user's say-so. */
export default function ToolConfirmationCard({ chatId, messageId, toolCallId, preview, argumentsJson, remainingMs }: Props) {
  const { t } = useTranslation();
  const { approve, reject, busy, error, canRespond } = useToolCallActions(chatId, messageId, toolCallId);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(() => prettyJson(argumentsJson));

  const editedIsValid = (() => {
    if (!editing) return true;
    try {
      const parsed = JSON.parse(edited);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
    } catch {
      return false;
    }
  })();

  const changed = editing && edited.trim() !== prettyJson(argumentsJson).trim();

  return (
    <Card padding="md" mt="xs" mb="sm">
      <div className="toolcard-title t-table-strong">{preview.title || t('toolCall.confirm.title')}</div>
      {preview.summary && (
        <div className="toolcard-summary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.summary}</ReactMarkdown>
        </div>
      )}
      {preview.fields.length > 0 && (
        <dl className="toolcard-fields">
          {preview.fields.map((field, index) => (
            <div key={index} className="toolcard-field">
              <dt className="t-overline">{field.label}</dt>
              <dd className={field.multiline ? 't-code toolcard-multiline' : 't-table'}>{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {preview.allowEdit && (
        <div className="toolcard-edit">
          <Button variant="ghost" size="small" onClick={() => setEditing(current => !current)} disabled={busy}>
            {editing ? t('toolCall.hideArguments') : t('toolCall.editArguments')}
          </Button>
          {editing && (
            <TextArea
              monospace
              error={editedIsValid ? undefined : t('toolCall.invalidJson')}
              mt="sm"
              value={edited}
              onChange={value => setEdited(value)}
              rows={Math.min(16, Math.max(4, edited.split('\n').length))}
              spellCheck={false}
              disabled={busy}
            />
          )}
        </div>
      )}
      <div className="toolcard-actions">
        <Button
          variant="primary"
          size="small"
          onClick={() => approve(changed ? edited : null)}
          disabled={busy || !canRespond || !editedIsValid}
        >
          {busy ? t('toolCall.working') : t('toolCall.approve')}
        </Button>
        <Button variant="subtle" size="small" onClick={() => reject()} disabled={busy || !canRespond}>
          {t('toolCall.reject')}
        </Button>
        {remainingMs !== null && (
          <span className="toolcard-countdown t-meta">{t('chat.activity.timeLeft', { duration: formatDuration(Math.max(0, remainingMs)) })}</span>
        )}
      </div>
      {error && <div className="toolcard-error t-caption">{error}</div>}
    </Card>
  );
}
