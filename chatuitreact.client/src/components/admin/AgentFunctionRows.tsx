import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminToolFunctionDto } from '../../types/admin';

interface AgentFunctionRowsProps {
  functions: AdminToolFunctionDto[];
}

/** An internal agent's functions, read-only. */
const AgentFunctionRows: React.FC<AgentFunctionRowsProps> = ({ functions }) => {
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
        </div>
      ))}
    </>
  );
};

export default AgentFunctionRows;
