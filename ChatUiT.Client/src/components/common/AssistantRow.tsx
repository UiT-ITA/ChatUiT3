import { useId, useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
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
  const activeCapabilities = CAPABILITIES.filter(({ key }) => capabilities[key]);
  const description = assistant.description || t('assistants.noDescriptionAvailable');
  const descriptionId = useId();
  const [tooltip, setTooltip] = useState<{ right: number; bottom: number } | null>(null);

  /** Places the tooltip above the info icon, right-aligned to it, in viewport coordinates. */
  const showTooltip = (e: SyntheticEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.top + 8 });
  };

  return (
    // A focusable div rather than a button: the favorite toggle is a
    // button that has to sit inline with the name, and buttons cannot nest.
    <div
      role="option"
      tabIndex={0}
      aria-selected={selected}
      aria-disabled={disabledReason !== undefined}
      aria-describedby={descriptionId}
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
      <div className="ap-row-head">
        <Icon name={ROW_ICON[assistant.type] ?? 'assistants'} size={1} className="ap-row-type-icon" />
        <span className="assistant-option-name t-body-strong">{assistant.name}</span>
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

      <div className="ap-row-meta">
        {modelName && (
          <>
            <span className="ap-row-model t-meta">{modelName}</span>
            <span className="ap-row-sep" aria-hidden="true" />
          </>
        )}
        <ClassificationBadge classification={assistant.classification} />
        {activeCapabilities.length > 0 && (
          <>
            <span className="ap-row-sep" aria-hidden="true" />
            <div className="assistant-capabilities">
              {activeCapabilities.map(({ key, icon }) => (
                <Icon
                  key={key}
                  name={icon}
                  size={1}
                  className="capability-icon"
                  title={t(`assistants.capabilities.${key}`)}
                />
              ))}
            </div>
          </>
        )}
        <div
          className="info-tooltip-container"
          role="img"
          aria-label={description}
          tabIndex={0}
          onMouseEnter={showTooltip}
          onMouseLeave={() => setTooltip(null)}
          onFocus={showTooltip}
          onBlur={() => setTooltip(null)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <Icon name="info" size={1} className="info-icon" />
        </div>
      </div>
      <span id={descriptionId} hidden>{description}</span>
      {tooltip && createPortal(
        <div className="info-tooltip t-caption" style={{ right: tooltip.right, bottom: tooltip.bottom }}>
          {description}
        </div>,
        document.body,
      )}
    </div>
  );
}
