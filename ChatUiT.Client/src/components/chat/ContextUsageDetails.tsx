import { useTranslation } from 'react-i18next';
import type { ContextUsage } from '../../services/contextUsageService';
import { formatTokens, formatTokensCompact } from '../../utils/tokenCounting';
import Stack from '../common/Stack';
import Text from '../common/Text';
import StackedBar from '../common/StackedBar';
import { Legend, LegendItem } from '../common/Legend';
import type { DataTone } from '../common/dataTone';

/** How full the context window is, and what fills it. */
export default function ContextUsageDetails({ usage }: { usage: ContextUsage }) {
  const { t, i18n } = useTranslation();

  const fractionOf = (value: number) => value / Math.max(1, usage.contextSize);
  const number = (value: number) => formatTokens(value, i18n.language);
  const shareOf = (value: number) => Math.round((value / Math.max(1, usage.total)) * 100);

  // What fills the window, in the order the request is assembled.
  const segments: { key: string; label: string; value: number; tone: DataTone }[] = [
    { key: 'prompt', label: 'chat.panel.contextSystemPrompt', value: usage.systemPrompt, tone: 'viz-1' },
    { key: 'knowledge', label: 'chat.panel.contextKnowledge', value: usage.knowledge, tone: 'viz-2' },
    { key: 'files', label: 'chat.panel.contextFiles', value: usage.files, tone: 'viz-3' },
    { key: 'messages', label: 'chat.panel.contextMessages', value: usage.messages, tone: 'viz-4' },
    { key: 'draft', label: 'chat.panel.contextDraft', value: usage.draft, tone: 'viz-5' },
  ];

  const usedTone = usage.level === 'normal' ? 'accent' : usage.level;

  return (
    <Stack gap="sm">
      <StackedBar
        role="meter"
        aria-valuemin={0}
        aria-valuemax={usage.contextSize}
        aria-valuenow={usage.total}
        segments={[
          { key: 'used', value: fractionOf(usage.total), tone: usedTone },
          { key: 'reserved', value: fractionOf(Math.min(usage.maxOutputTokens, Math.max(0, usage.contextSize - usage.total))), tone: 'reserved' },
        ]}
      />
      <Legend>
        <LegendItem
          tone={usedTone}
          label={t('chat.panel.contextUsedLabel')}
          state={usage.level}
          value={(
            <>
              {usage.isEstimate && '≈ '}
              {t('chat.panel.contextUsed', {
                used: number(usage.total),
                limit: formatTokensCompact(usage.contextSize, i18n.language),
              })}
            </>
          )}
        />
        <LegendItem tone="reserved" label={t('chat.panel.contextReserved')} value={number(usage.maxOutputTokens)} />
      </Legend>

      <Text as="div" variant="hint" tone="muted" mt="sm">{t('chat.panel.contextComposition')}</Text>
      {usage.total > 0 && (
        <StackedBar
          scale="relative"
          mt="xs"
          role="img"
          aria-label={t('chat.panel.contextComposition')}
          segments={segments.filter((segment) => segment.value > 0).map((segment) => ({ key: segment.key, value: segment.value, tone: segment.tone }))}
        />
      )}
      <Legend>
        {segments.map((segment) => (
          <LegendItem
            key={segment.key}
            tone={segment.tone}
            label={t(segment.label)}
            value={number(segment.value)}
            share={t('chat.panel.contextPercent', { value: shareOf(segment.value) })}
          />
        ))}
      </Legend>
      {usage.unknownMessages > 0 && (
        <Text as="div" variant="hint" tone="muted">{t('chat.panel.contextUnknown', { count: usage.unknownMessages })}</Text>
      )}
      {usage.isEstimate && (
        <Text as="div" variant="hint" tone="muted">{t('chat.panel.contextEstimate')}</Text>
      )}
      {usage.overLimit && (
        <Text as="div" variant="caption" tone="danger">{t('chat.panel.contextOver')}</Text>
      )}
    </Stack>
  );
}
