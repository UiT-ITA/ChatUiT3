import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminToolFunctionDto } from '../../types/admin';
import ClassificationBadge from '../common/ClassificationBadge';

interface AgentFunctionRowsProps {
  functions: AdminToolFunctionDto[];
  /** Shows each function's data classification. */
  showClassification?: boolean;
}

/** An internal agent's functions, read-only. */
const AgentFunctionRows: React.FC<AgentFunctionRowsProps> = ({ functions, showClassification }) => {
  const { t } = useTranslation();
  return (
    <>
      {functions.map(fn => (
        <div key={fn.id} className="admin-list-row" style={{ cursor: 'default' }}>
          <div className="admin-row-main">
            <div className="admin-row-title t-code">{fn.id}</div>
            <div className="admin-row-subtitle t-caption">{fn.description}</div>
            {(fn.requiresConfirmation || fn.requiredScopes.length > 0) && (
              <div className="t-caption">
                {[
                  fn.requiresConfirmation ? t('admin.tools.fields.requiresConfirmation') : null,
                  fn.requiredScopes.length > 0 ? fn.requiredScopes.join(', ') : null,
                ].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          {showClassification && <ClassificationBadge classification={fn.classification} />}
        </div>
      ))}
    </>
  );
};

export default AgentFunctionRows;
