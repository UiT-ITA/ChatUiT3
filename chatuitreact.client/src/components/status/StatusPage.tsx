import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDevStatus, type DevStatusDto } from '../../services/devStatusService';
import './StatusPage.css';

/** Development only: dumps what the API sees of the signed-in user, so access questions can be settled from facts. */
const StatusPage: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<DevStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDevStatus()
      .then(result => { if (!cancelled) setStatus(result); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <div className="status-page"><div className="status-page-content"><div className="status-error t-body">{error}</div></div></div>;
  }

  if (!status) {
    return <div className="status-page"><div className="status-page-content"><div className="t-ui-plain">{t('common.loading')}</div></div></div>;
  }

  const groupClaims = status.claims.filter(claim => claim.type === 'groups' || claim.type.endsWith('/claims/groups'));

  return (
    <div className="status-page">
      <div className="status-page-content">
      <h1 className="t-page-title">{t('status.title')}</h1>
      <div className="page-title-bar" />

      <section className="status-section">
        <h2 className="t-overline">{t('status.resolved')}</h2>
        <dl className="status-facts">
          <dt className="t-label">{t('status.environment')}</dt>
          <dd className="t-code">{status.environment}</dd>
          <dt className="t-label">{t('status.userId')}</dt>
          <dd className="t-code">{status.userId}</dd>
          <dt className="t-label">{t('status.roles')}</dt>
          <dd className="t-code">{status.roles.join(', ') || '—'}</dd>
          <dt className="t-label">{t('status.groupIds')}</dt>
          <dd className="t-code">{status.groupIds.length > 0 ? status.groupIds.join('\n') : '—'}</dd>
        </dl>
        {status.groupsOverage && (
          <div className="status-warn t-caption">{t('status.groupsOverage')}</div>
        )}
        {!status.groupsOverage && groupClaims.length === 0 && (
          <div className="status-warn t-caption">{t('status.noGroupsClaim')}</div>
        )}
      </section>

      <section className="status-section">
        <h2 className="t-overline">{t('status.claims', { count: status.claims.length })}</h2>
        <table className="status-claims">
          <thead>
            <tr>
              <th className="t-label">{t('status.claimType')}</th>
              <th className="t-label">{t('status.claimValue')}</th>
            </tr>
          </thead>
          <tbody>
            {status.claims.map((claim, index) => (
              <tr key={`${claim.type}-${index}`}>
                <td className="t-code">{claim.type}</td>
                <td className="t-code">{claim.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      </div>
    </div>
  );
};

export default StatusPage;
