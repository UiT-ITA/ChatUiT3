import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatTokens } from '../../utils/tokenCounting';
import ProgressBar from '../common/ProgressBar';
import Text from '../common/Text';
import Alert from '../common/Alert';
import Stack from '../common/Stack';

const WARN_FRACTION = 0.8;

interface AlwaysLoadedBudgetProps {
  /** What the stored files use, as counted by the server. Undefined when a stored file has no count for this model. */
  used: number | undefined;
  /** Files are added that are not saved yet. The server counts them when the assistant is saved. */
  hasUnsavedFiles: boolean;
  limit: number;
  isEstimate: boolean;
  /** Over the limit in a way that blocks saving. */
  blocked: boolean;
}

const AlwaysLoadedBudget = ({ used, hasUnsavedFiles, limit, isEstimate, blocked }: AlwaysLoadedBudgetProps) => {
  const { t, i18n } = useTranslation();
  const usedId = useId();
  const number = (value: number) => formatTokens(value, i18n.language);
  const approx = isEstimate ? '≈ ' : '';

  if (used === undefined) {
    return (
      <Text as="div" variant="meta" tone="muted">
        {t('assistants.knowledge.budget.unavailable')}
      </Text>
    );
  }

  const over = used > limit;
  const state = over ? 'danger' : used >= limit * WARN_FRACTION ? 'warn' : 'normal';

  return (
    <Stack gap="sm">
      <ProgressBar value={used} max={limit} state={state} aria-labelledby={usedId} />
      <Text as="div" id={usedId} variant="ui" tone={state === 'danger' ? 'danger' : state === 'warn' ? 'warning' : 'secondary'}>
        {approx}{t('assistants.knowledge.budget.used', { used: number(used), limit: number(limit) })}
      </Text>
      <Text as="p" variant="meta" tone="muted" leading="base">
        {t('assistants.knowledge.budget.explanation', { limit: number(limit) })}
        {isEstimate && <> {t('assistants.knowledge.budget.estimate')}</>}
      </Text>

      {over && (
        <Alert tone="danger" role="alert">
          {t(blocked ? 'assistants.knowledge.budget.overBlocked' : 'assistants.knowledge.budget.overAllowed', {
            used: approx + number(used),
            limit: number(limit)
          })}
        </Alert>
      )}
      {hasUnsavedFiles && (
        <Text as="p" variant="meta" tone="muted" leading="base">{t('assistants.knowledge.budget.unsavedFiles')}</Text>
      )}
    </Stack>
  );
};

export default AlwaysLoadedBudget;
