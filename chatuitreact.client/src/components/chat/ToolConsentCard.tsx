import { useTranslation } from 'react-i18next';
import { useToolCallActions } from '../../hooks/useToolCallActions';
import { formatDuration } from '../../utils/durationUtils';

type Props = {
  chatId: string | null;
  messageId: string;
  toolCallId: string;
  toolName: string;
  scopes: string[];
  remainingMs: number | null;
};

/** Shown when a tool needs Microsoft Graph access the user has not yet granted this app. */
export default function ToolConsentCard({ chatId, messageId, toolCallId, toolName, scopes, remainingMs }: Props) {
  const { t } = useTranslation();
  const { grantConsent, declineConsent, busy, error, canRespond } = useToolCallActions(chatId, messageId, toolCallId);

  return (
    <div className="toolcard toolcard-consent">
      <div className="toolcard-title t-table-strong">{t('toolCall.consent.title')}</div>
      <p className="toolcard-text t-table">{t('toolCall.consent.body', { name: toolName })}</p>
      <ul className="toolcard-scopes">
        {scopes.map(scope => (
          <li key={scope} className="t-table">
            {t(`toolCall.consent.scopes.${scope.replace(/\./g, '_')}`, { defaultValue: scope })}
            <span className="t-meta toolcard-scope-raw"> ({scope})</span>
          </li>
        ))}
      </ul>
      <div className="toolcard-actions">
        <button type="button" className="toolcard-button primary t-ui" onClick={() => grantConsent(scopes)} disabled={busy || !canRespond}>
          {busy ? t('toolCall.working') : t('toolCall.consent.grant')}
        </button>
        <button type="button" className="toolcard-button t-ui" onClick={() => declineConsent()} disabled={busy || !canRespond}>
          {t('toolCall.consent.decline')}
        </button>
        {remainingMs !== null && (
          <span className="toolcard-countdown t-meta">{t('chat.activity.timeLeft', { duration: formatDuration(Math.max(0, remainingMs)) })}</span>
        )}
      </div>
      {error && <div className="toolcard-error t-caption">{error}</div>}
    </div>
  );
}
