import { useTranslation } from 'react-i18next';
import { formatTokens } from '../../utils/tokenCounting';
import Button from '../common/Button';
import './AlwaysLoadedBudget.css';
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
      <div className="always-loaded-budget t-meta">
        {t(unavailable ? 'assistants.knowledge.budget.unavailable' : 'assistants.knowledge.budget.counting')}
      </div>
    );
  }

  const over = used > limit;
  const state = over ? 'danger' : used >= limit * WARN_FRACTION ? 'warn' : 'ok';

  return (
    <div className="always-loaded-budget" data-state={state}>
      <div className="always-loaded-budget__meter" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
        <div className="always-loaded-budget__fill" style={{ width: `${Math.min(100, limit > 0 ? (used / limit) * 100 : 100)}%` }} />
      </div>
      <div className="always-loaded-budget__used t-ui">
        {approx}{t('assistants.knowledge.budget.used', { used: number(used), limit: number(limit) })}
      </div>
      <p className="always-loaded-budget__explanation t-meta">
        {t('assistants.knowledge.budget.explanation', { limit: number(limit) })}
        {isEstimate && <> {t('assistants.knowledge.budget.estimate')}</>}
      </p>

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
              <div key={file.id} className="always-loaded-budget__rejected">
                <div className="t-ui">{t('assistants.knowledge.budget.rejectedTitle', { name: file.name })}</div>
                <div className="t-ui-plain">
                  {t('assistants.knowledge.budget.rejected', {
                    tokens: approx + number(file.tokens),
                    remaining: number(Math.max(0, file.remaining))
                  })}
                </div>
              </div>
            ))}
            <Button variant="subtle" size="small" alignSelf="end" onClick={onDismissRejected}>
              {t('common.close')}
            </Button>
          </Stack>
        </Alert>
      )}
    </div>
  );
};

export default AlwaysLoadedBudget;
