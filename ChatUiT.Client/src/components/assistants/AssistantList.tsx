import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { getAssistants } from "../../services/assistantService";
import { getModels } from "../../services/modelService";
import { useSignals } from "@preact/signals-react/runtime";
import type { AssistantDto, FullAssistantDto, AssistantSummaryDto } from "../../types/assistantModels";
import NavItem from '../common/NavItem';

interface AssistantListProps {
  activeId?: string;
  onNavigate?: () => void;
}

export function AssistantList({ activeId, onNavigate }: AssistantListProps) {
  useSignals();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const assistantList = getAssistants();
  const models = getModels().value ?? [];

  if (assistantList.value === undefined) {
    return <div className="context-column-note t-ui-plain">{t('common.loading')}</div>;
  }

  const renderAssistantRows = (assistants: (FullAssistantDto | AssistantSummaryDto)[], type: AssistantDto['type']) => {
    if (assistants.length === 0) {
      const emptyStateKey = type === 'owned' ? 'assistants.emptyStates.noPersonalAssistants' :
                           type === 'system' ? 'assistants.emptyStates.noSystemAssistants' :
                           'assistants.emptyStates.noSharedAssistants';
      return <div className="context-column-note t-ui-plain">{t(emptyStateKey)}</div>;
    }
    return assistants.map((assistant) => {
      const modelName = models.find(m => m.id === assistant.modelId)?.modelName;
      const fileCount = type === 'owned' ? ((assistant as FullAssistantDto).files ?? []).length : undefined;
      const meta = [
        fileCount !== undefined && fileCount > 0 ? t('assistants.fileCount', { count: fileCount }) : undefined,
        modelName
      ].filter(Boolean).join(' · ');

      return (
        <NavItem
          key={assistant.id}
          active={assistant.id === activeId}
          description={assistant.description || undefined}
          meta={meta || undefined}
          onClick={() => {
            navigate(`/assistants/${assistant.id}`);
            onNavigate?.();
          }}
        >
          {assistant.name}
        </NavItem>
      );
    });
  };

  return (
    <div>
      <div className="context-group-label t-group-label">{t('assistants.myAssistants')}</div>
      {renderAssistantRows(assistantList.value.owned, 'owned')}

      <div className="context-group-label t-group-label">{t('assistants.systemAssistants')}</div>
      {renderAssistantRows(assistantList.value.system, 'system')}

      <div className="context-group-label t-group-label">{t('assistants.sharedAssistants')}</div>
      {renderAssistantRows(assistantList.value.shared, 'shared')}
    </div>
  );
}
