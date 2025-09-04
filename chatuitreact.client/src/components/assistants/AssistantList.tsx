import { Link } from "react-router-dom";
import { getAssistants } from "../../services/assistantService";
import { useSignals } from "@preact/signals-react/runtime";
import type { AssistantDto, PrivateAssistantDto, SharedAssistantDto, SystemAssistantDto } from "../../types/assistantModels";

export function AssistantList() {
  useSignals();
  const assistantList = getAssistants();

  if (assistantList.value === undefined) {
    return <div>Loading assistants...</div>;
  }

  const renderAssistantLinks = (assistants: (PrivateAssistantDto | SystemAssistantDto | SharedAssistantDto)[], type: AssistantDto['type']) => {
    if (assistants.length === 0) {
      return <div>No {type} assistants found.</div>;
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
      <h3>My Assistants</h3>
      {renderAssistantLinks(assistantList.value.owned, 'owned')}

      <h3>System Assistants</h3>
      {renderAssistantLinks(assistantList.value.system, 'system')}

      <h3>Shared Assistants</h3>
      {renderAssistantLinks(assistantList.value.shared, 'shared')}
    </div>
  );
}
