import { useTranslation } from 'react-i18next';
import { formatTokens } from '../../utils/tokenCounting';
import Button from '../common/Button';
import ProgressBar from '../common/ProgressBar';
import Text from '../common/Text';
import Alert from '../common/Alert';
import Stack from '../common/Stack';

const WARN_FRACTION = 0.8;

export interface RejectedKnowledgeFile {
  id: string;
  name: string;
  tokens: number;
  remaining: number;
}

interface AlwaysLoadedBudgetProps {
  /** Undefined while the files are being counted, or when a stored file has no count. */
  used: number | undefined;
  /** A stored file has no count for this model. */
  unavailable: boolean;
  limit: number;
  isEstimate: boolean;
  /** Over the limit in a way that blocks saving. */
  blocked: boolean;
  rejected: RejectedKnowledgeFile[];
  onDismissRejected: () => void;
}

const AlwaysLoadedBudget = ({ used, unavailable, limit, isEstimate, blocked, rejected, onDismissRejected }: AlwaysLoadedBudgetProps) => {
  const { t, i18n } = useTranslation();
  const number = (value: number) => formatTokens(value, i18n.language);
  const approx = isEstimate ? '≈ ' : '';

  if (used === undefined) {
    return (
      <Text as="div" variant="meta" tone="muted">
        {t(unavailable ? 'assistants.knowledge.budget.unavailable' : 'assistants.knowledge.budget.counting')}
      </Text>
    );
  }

  const over = used > limit;
  const state = over ? 'danger' : used >= limit * WARN_FRACTION ? 'warn' : 'normal';

  return (
    <Stack gap="sm">
      <ProgressBar value={used} max={limit} state={state} />
      <Text as="div" variant="ui" tone={state === 'danger' ? 'danger' : state === 'warn' ? 'warning' : 'secondary'}>
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

      {rejected.length > 0 && (
        <Alert tone="warning" role="alert">
          <Stack gap="sm">
            {rejected.map((file) => (
              <Stack key={file.id} gap="xs">
                <Text as="div" variant="ui">{t('assistants.knowledge.budget.rejectedTitle', { name: file.name })}</Text>
                <Text as="div" variant="ui-plain">
                  {t('assistants.knowledge.budget.rejected', {
                    tokens: approx + number(file.tokens),
                    remaining: number(Math.max(0, file.remaining))
                  })}
                </Text>
              </Stack>
            ))}
            <Button variant="subtle" size="small" alignSelf="end" onClick={onDismissRejected}>
              {t('common.close')}
            </Button>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
};

export default AlwaysLoadedBudget;
