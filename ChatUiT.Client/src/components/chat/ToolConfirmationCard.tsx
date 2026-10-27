import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ToolPreviewDto } from '../../types/chatModels';
import { useToolCallActions } from '../../hooks/useToolCallActions';
import { formatDuration } from '../../utils/durationUtils';

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
    <div className="toolcard toolcard-confirm">
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
          <button type="button" className="toolcard-link t-caption" onClick={() => setEditing(current => !current)} disabled={busy}>
            {editing ? t('toolCall.hideArguments') : t('toolCall.editArguments')}
          </button>
          {editing && (
            <textarea
              className={`toolcard-textarea t-code ${editedIsValid ? '' : 'invalid'}`}
              value={edited}
              onChange={event => setEdited(event.target.value)}
              rows={Math.min(16, Math.max(4, edited.split('\n').length))}
              spellCheck={false}
              disabled={busy}
            />
          )}
          {editing && !editedIsValid && <div className="toolcard-error t-caption">{t('toolCall.invalidJson')}</div>}
        </div>
      )}
      <div className="toolcard-actions">
        <button
          type="button"
          className="toolcard-button primary t-ui"
          onClick={() => approve(changed ? edited : null)}
          disabled={busy || !canRespond || !editedIsValid}
        >
          {busy ? t('toolCall.working') : t('toolCall.approve')}
        </button>
        <button type="button" className="toolcard-button t-ui" onClick={() => reject()} disabled={busy || !canRespond}>
          {t('toolCall.reject')}
        </button>
        {remainingMs !== null && (
          <span className="toolcard-countdown t-meta">{t('chat.activity.timeLeft', { duration: formatDuration(Math.max(0, remainingMs)) })}</span>
        )}
      </div>
      {error && <div className="toolcard-error t-caption">{error}</div>}
    </div>
  );
}
