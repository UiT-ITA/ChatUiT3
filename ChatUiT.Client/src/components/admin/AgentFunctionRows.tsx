import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminToolFunctionDto } from '../../types/admin';
import ClassificationBadge from '../classification/ClassificationBadge';
import { List } from '../common/List';
import Stack from '../common/Stack';
import Text from '../common/Text';

interface AgentFunctionRowsProps {
  functions: AdminToolFunctionDto[];
  /** Shows each function's data classification. */
  showClassification?: boolean;
}

/** An internal agent's functions, read-only. */
const AgentFunctionRows: React.FC<AgentFunctionRowsProps> = ({ functions, showClassification }) => {
  const { t } = useTranslation();
  return (
    <List bordered>
      {functions.map(fn => (
        <Stack key={fn.id} direction="row" align="center" gap="lg" p="md">
          <Stack gap="xs" expand>
            <Text variant="code">{fn.id}</Text>
            <Text variant="caption" tone="secondary">{fn.description}</Text>
            {(fn.requiresConfirmation || fn.requiredScopes.length > 0) && (
              <Text variant="caption" tone="muted">
                {[
                  fn.requiresConfirmation ? t('admin.tools.fields.requiresConfirmation') : null,
                  fn.requiredScopes.length > 0 ? fn.requiredScopes.join(', ') : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            )}
          </Stack>
          {showClassification && <ClassificationBadge classification={fn.classification} />}
        </Stack>
      ))}
    </List>
  );
};

export default AgentFunctionRows;
