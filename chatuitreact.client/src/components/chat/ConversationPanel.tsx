import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Icon';
import { getChat, getSelectableAssistants } from '../../services/chatService';
import { getContextUsage } from '../../services/contextUsageService';
import { formatTokens, formatTokensCompact } from '../../utils/tokenCounting';
import './ConversationPanel.css';

interface ConversationPanelProps {
  chatId: string;
}

function ConversationPanel({ chatId }: ConversationPanelProps) {
  useSignals();
  const { t, i18n } = useTranslation();

  const chat = getChat(chatId).value;
  const assistants = getSelectableAssistants().value || [];
  const assistant = chat ? assistants.find((a) => a.id === chat.assistantId) : undefined;

  const files = chat?.messages.flatMap((message) => message.files || []) || [];
  const usage = getContextUsage(chatId).value;
  const usageState = usage.overLimit ? 'over' : usage.nearLimit ? 'near' : 'ok';
  const percentOf = (value: number) => `${Math.min(100, (value / Math.max(1, usage.contextSize)) * 100)}%`;
  const number = (value: number) => formatTokens(value, i18n.language);

  const formatDate = (value: string | undefined) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <aside className="conversation-panel">
      <div className="conversation-panel-title t-overline">{t('chat.panel.title')}</div>

      <div className="conversation-panel-section t-overline">{t('chat.panel.files')}</div>
      {files.length > 0 ? (
        <div className="conversation-panel-files">
          {files.map((file) => (
            <div key={file.id} className="conversation-panel-file t-caption">
              <Icon name="file" size={0.875} className="conversation-panel-file-icon" />
              <span>{file.sourceFilename}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="conversation-panel-empty t-caption">{t('chat.panel.noFiles')}</div>
      )}

      <div className="conversation-panel-section t-overline">{t('chat.panel.context')}</div>
      {usage.available ? (
        <div className="context-usage" data-state={usageState}>
          <div className="context-meter" role="meter" aria-valuemin={0} aria-valuemax={usage.contextSize} aria-valuenow={usage.total}>
            <div className="context-meter-fill" style={{ width: percentOf(usage.total) }} />
            <div className="context-meter-reserved" style={{ width: percentOf(Math.min(usage.maxOutputTokens, Math.max(0, usage.contextSize - usage.total))) }} />
          </div>
          <div className="context-usage-total t-meta">
            {usage.isEstimate && '≈ '}
            {t('chat.panel.contextUsed', {
              used: number(usage.total),
              limit: formatTokensCompact(usage.contextSize, i18n.language),
            })}
          </div>
          <div className="context-usage-rows">
            <div className="context-usage-row t-hint"><span>{t('chat.panel.contextPrompt')}</span><span>{number(usage.fixed)}</span></div>
            <div className="context-usage-row t-hint"><span>{t('chat.panel.contextHistory')}</span><span>{number(usage.history)}</span></div>
            <div className="context-usage-row t-hint"><span>{t('chat.panel.contextDraft')}</span><span>{number(usage.draft)}</span></div>
            <div className="context-usage-row t-hint"><span>{t('chat.panel.contextReserved')}</span><span>{number(usage.maxOutputTokens)}</span></div>
          </div>
          {usage.unknownMessages > 0 && (
            <div className="context-usage-note t-hint">{t('chat.panel.contextUnknown', { count: usage.unknownMessages })}</div>
          )}
          {usage.isEstimate && (
            <div className="context-usage-note t-hint">{t('chat.panel.contextEstimate')}</div>
          )}
          {usage.overLimit && (
            <div className="context-usage-over t-caption">{t('chat.panel.contextOver')}</div>
          )}
        </div>
      ) : (
        <div className="conversation-panel-empty t-caption">{t('chat.panel.contextUnavailable')}</div>
      )}

      <div className="conversation-panel-meta t-hint">
        {assistant && <>{t('chat.panel.assistant')}: {assistant.name}<br /></>}
        {chat?.createdAt && <>{t('chat.panel.created')}: {formatDate(chat.createdAt)}<br /></>}
        {chat?.updatedAt && <>{t('chat.panel.updated')}: {formatDate(chat.updatedAt)}</>}
      </div>
    </aside>
  );
}

export default ConversationPanel;
