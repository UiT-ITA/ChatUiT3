import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDevStatus, type DevStatusDto } from '../../services/devStatusService';
import PageTitleBar from '../common/PageTitleBar';
import Page from '../common/Page';
import Box from '../common/Box';
import Text from '../common/Text';
import DescriptionList from '../common/DescriptionList';
import Table from '../common/Table';

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
    return <Page width="wide"><Text as="div" variant="body" tone="danger">{error}</Text></Page>;
  }

  if (!status) {
    return <Page width="wide"><Text as="div" variant="ui-plain">{t('common.loading')}</Text></Page>;
  }

  const groupClaims = status.claims.filter(claim => claim.type === 'groups' || claim.type.endsWith('/claims/groups'));

  return (
    <Page width="wide">
      <Text as="h1" variant="page-title">{t('status.title')}</Text>
      <PageTitleBar />

      <Box as="section" mt="xl">
        <Text as="h2" variant="overline" tone="muted" mb="md">{t('status.resolved')}</Text>
        <DescriptionList
          termVariant="label"
          detailsVariant="code"
          items={[
            { term: t('status.environment'), details: status.environment },
            { term: t('status.userId'), details: status.userId },
            { term: t('status.roles'), details: status.roles.join(', ') || '—' },
            { term: t('status.groupIds'), details: status.groupIds.length > 0 ? status.groupIds.join('\n') : '—' },
          ]}
        />
        {(status.groupsOverage || groupClaims.length === 0) && (
          <Text as="div" variant="caption" tone="warning" mt="md">{t(status.groupsOverage ? 'status.groupsOverage' : 'status.noGroupsClaim')}</Text>
        )}
      </Box>

      <Box as="section" mt="xl">
        <Text as="h2" variant="overline" tone="muted" mb="md">{t('status.claims', { count: status.claims.length })}</Text>
        <Table
          headVariant="label"
          cellVariant="code"
          columns={[t('status.claimType'), t('status.claimValue')]}
          rows={status.claims.map((claim, index) => ({ key: `${claim.type}-${index}`, cells: [claim.type, claim.value] }))}
        />
      </Box>
    </Page>
  );
};

export default StatusPage;
