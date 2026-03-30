import { Link } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { getAssistants } from "../../services/assistantService";
import { useSignals } from "@preact/signals-react/runtime";
import type { AssistantDto, FullAssistantDto, AssistantSummaryDto } from "../../types/assistantModels";

export function AssistantList() {
  useSignals();
  const { t } = useTranslation();
  const assistantList = getAssistants();

  if (assistantList.value === undefined) {
    return <div>{t('common.loading')}</div>;
  }

  const renderAssistantLinks = (assistants: (FullAssistantDto | AssistantSummaryDto)[], type: AssistantDto['type']) => {
    if (assistants.length === 0) {
      const emptyStateKey = type === 'owned' ? 'assistants.emptyStates.noPersonalAssistants' :
                           type === 'system' ? 'assistants.emptyStates.noSystemAssistants' :
                           'assistants.emptyStates.noSharedAssistants';
      return <div>{t(emptyStateKey)}</div>;
    }
    return (
      <ul>
        {assistants.map((assistant) => (
          <li key={assistant.id}>
            <Link to={`/assistants/${assistant.id}`}>{assistant.name}</Link>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div>
      <h3>{t('assistants.myAssistants')}</h3>
      {renderAssistantLinks(assistantList.value.owned, 'owned')}

      <h3>{t('assistants.systemAssistants')}</h3>
      {renderAssistantLinks(assistantList.value.system, 'system')}

      <h3>{t('assistants.sharedAssistants')}</h3>
      {renderAssistantLinks(assistantList.value.shared, 'shared')}
    </div>
  );
}
