import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from './Icon';
import { toggleFavorite } from '../../services/assistantService';
import { getModels } from '../../services/modelService';
import type { AssistantDto } from '../../types/assistantModels';
import { CAPABILITIES, capabilitiesOf } from './assistantCapabilities';
import ClassificationBadge from './ClassificationBadge';
import './AssistantRow.css';

/** Categories map onto AssistantDto.type, except 'all' and the per-user 'favorites'. */
const ROW_ICON: Record<AssistantDto['type'], IconName> = {
  system: 'shield',
  owned: 'user',
  shared: 'people',
};

interface AssistantRowProps {
  assistant: AssistantDto;
  selected: boolean;
  /** Shown but not selectable, with this text as the reason. */
  disabledReason?: string;
  onSelect: (assistant: AssistantDto) => void;
}

export default function AssistantRow({ assistant, selected, disabledReason, onSelect }: AssistantRowProps) {
  useSignals();
  const { t } = useTranslation();
  const models = getModels().value ?? [];
  const capabilities = capabilitiesOf(assistant, models);
  const modelName = models.find(m => m.id === assistant.modelId)?.modelName;

  return (
    // A focusable div rather than a button: the favorite toggle is a
    // button that has to sit inline with the name, and buttons cannot nest.
    <div
      role="option"
      tabIndex={0}
      aria-selected={selected}
      aria-disabled={disabledReason !== undefined}
      title={disabledReason}
      className={`assistant-option ${selected ? 'selected' : ''} ${disabledReason !== undefined ? 'disabled' : ''}`}
      onClick={() => {
        if (disabledReason === undefined) onSelect(assistant);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (disabledReason === undefined) onSelect(assistant);
        }
      }}
    >
      <div className="ap-row-main">
        <div className="ap-row-head">
          <Icon name={ROW_ICON[assistant.type] ?? 'assistants'} size={1} className="ap-row-type-icon" />
          <span className="assistant-option-name t-body-strong">{assistant.name}</span>
          {modelName && <span className="ap-row-model t-meta">{modelName}</span>}
          <ClassificationBadge classification={assistant.classification} />
          <button
            type="button"
            className={`ap-row-favorite ${assistant.isFavorite ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              // The server pushes AssistantsUpdated, which re-fetches the list.
              void toggleFavorite(assistant.id);
            }}
            title={assistant.isFavorite
              ? t('assistants.actions.removeFavorite')
              : t('assistants.actions.addFavorite')}
          >
            <Icon name={assistant.isFavorite ? 'star' : 'starOutline'} size={0.9375} />
          </button>
        </div>
        <div className="ap-row-desc t-caption">
          {assistant.description || t('assistants.noDescriptionAvailable')}
        </div>
      </div>

      <div className="ap-row-aside">
        <div className="assistant-capabilities">
          {CAPABILITIES.map(({ key, icon }) => capabilities[key] && (
            <Icon
              key={key}
              name={icon}
              size={1}
              className="capability-icon"
              title={t(`assistants.capabilities.${key}`)}
            />
          ))}
        </div>
        <div className="info-tooltip-container">
          <Icon name="info" size={1} className="info-icon" />
          <div className="info-tooltip t-caption">
            {assistant.description || t('assistants.noDescriptionAvailable')}
          </div>
        </div>
      </div>
    </div>
  );
}
