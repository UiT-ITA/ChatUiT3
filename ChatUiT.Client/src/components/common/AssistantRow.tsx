import { useId } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from './Icon';
import IconButton from './IconButton';
import { toggleFavorite } from '../../services/assistantService';
import { getModels } from '../../services/modelService';
import type { AssistantDto } from '../../types/assistantModels';
import { CAPABILITIES, capabilitiesOf } from './assistantCapabilities';
import ClassificationBadge from './ClassificationBadge';
import { ListboxOption } from './Listbox';
import Stack from './Stack';
import Tooltip from './Tooltip';
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

  return (
    <ListboxOption
      selected={selected}
      disabled={disabledReason !== undefined}
      title={disabledReason}
      aria-describedby={descriptionId}
      onClick={() => onSelect(assistant)}
      leading={<Icon name={ROW_ICON[assistant.type] ?? 'assistants'} color="muted" />}
      description={(
        <span className="ap-row-meta">
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
              <Stack direction="row" gap="sm" align="center" shrink={false}>
                {activeCapabilities.map(({ key, icon }) => (
                  <Icon
                    key={key}
                    name={icon}
                    color="accent"
                    label={t(`assistants.capabilities.${key}`)}
                  />
                ))}
              </Stack>
            </>
          )}
          <Tooltip content={description} focusable>
            <Icon name="info" color="muted" label={description} />
          </Tooltip>
          <span id={descriptionId} hidden>{description}</span>
        </span>
      )}
      trailing={(
        <IconButton
          icon={<Icon name={assistant.isFavorite ? 'star' : 'starOutline'} color={assistant.isFavorite ? 'accent' : 'muted'} />}
          label={assistant.isFavorite
            ? t('assistants.actions.removeFavorite')
            : t('assistants.actions.addFavorite')}
          size="small"
          aria-pressed={assistant.isFavorite}
          onClick={(e) => {
            e.stopPropagation();
            // The server pushes AssistantsUpdated, which re-fetches the list.
            void toggleFavorite(assistant.id);
          }}
        />
      )}
    >
      <span className="t-body-strong">{assistant.name}</span>
    </ListboxOption>
  );
}
