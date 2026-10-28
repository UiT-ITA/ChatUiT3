import { useTranslation } from 'react-i18next';
import type { ContextUsage } from '../../services/contextUsageService';
import { formatTokens, formatTokensCompact } from '../../utils/tokenCounting';
import './ContextUsageDetails.css';

interface ContextUsageDetailsProps {
  usage: ContextUsage;
}

/** How full the context window is, and what fills it. */
export default function ContextUsageDetails({ usage }: ContextUsageDetailsProps) {
  const { t, i18n } = useTranslation();

  const percentOf = (value: number) => `${Math.min(100, (value / Math.max(1, usage.contextSize)) * 100)}%`;
  const number = (value: number) => formatTokens(value, i18n.language);
  const shareOf = (value: number) => Math.round((value / Math.max(1, usage.total)) * 100);

  // What fills the window, in the order the request is assembled.
  const segments = [
    { key: 'prompt', label: 'chat.panel.contextSystemPrompt', value: usage.systemPrompt },
    { key: 'knowledge', label: 'chat.panel.contextKnowledge', value: usage.knowledge },
    { key: 'files', label: 'chat.panel.contextFiles', value: usage.files },
    { key: 'messages', label: 'chat.panel.contextMessages', value: usage.messages },
    { key: 'draft', label: 'chat.panel.contextDraft', value: usage.draft },
  ];

  return (
    <div className="context-usage" data-state={usage.level}>
      <div className="context-meter" role="meter" aria-valuemin={0} aria-valuemax={usage.contextSize} aria-valuenow={usage.total}>
        <div className="context-meter-fill" style={{ width: percentOf(usage.total) }} />
        <div className="context-meter-reserved" style={{ width: percentOf(Math.min(usage.maxOutputTokens, Math.max(0, usage.contextSize - usage.total))) }} />
      </div>
      <ul className="context-legend context-legend--usage">
        <li className="context-legend-row context-legend-row--wide t-hint">
          <span className="context-legend-swatch" data-segment="used" />
          <span className="context-legend-label">{t('chat.panel.contextUsedLabel')}</span>
          <span className="context-legend-value context-usage-total">
            {usage.isEstimate && '≈ '}
            {t('chat.panel.contextUsed', {
              used: number(usage.total),
              limit: formatTokensCompact(usage.contextSize, i18n.language),
            })}
          </span>
        </li>
        <li className="context-legend-row context-legend-row--wide t-hint">
          <span className="context-legend-swatch" data-segment="reserved" />
          <span className="context-legend-label">{t('chat.panel.contextReserved')}</span>
          <span className="context-legend-value">{number(usage.maxOutputTokens)}</span>
        </li>
      </ul>

      <div className="context-subheader t-hint">{t('chat.panel.contextComposition')}</div>
      {usage.total > 0 && (
        <div className="context-composition" role="img" aria-label={t('chat.panel.contextComposition')}>
          {segments.filter((segment) => segment.value > 0).map((segment) => (
            <div
              key={segment.key}
              className="context-composition-segment"
              data-segment={segment.key}
              style={{ flexGrow: segment.value }}
            />
          ))}
        </div>
      )}
      <ul className="context-legend">
        {segments.map((segment) => (
          <li key={segment.key} className="context-legend-row t-hint">
            <span className="context-legend-swatch" data-segment={segment.key} />
            <span className="context-legend-label">{t(segment.label)}</span>
            <span className="context-legend-value">{number(segment.value)}</span>
            <span className="context-legend-share">{t('chat.panel.contextPercent', { value: shareOf(segment.value) })}</span>
          </li>
        ))}
      </ul>
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
  );
}
