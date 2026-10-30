import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../common/Icon';
import IconButton from '../common/IconButton';
import Card from '../common/Card';
import ClassificationBadge from '../common/ClassificationBadge';
import { CAPABILITIES, capabilitiesOf } from '../common/assistantCapabilities';
import { cx } from '../common/layout';
import { toggleFavorite } from '../../services/assistantService';
import { getModels } from '../../services/modelService';
import type { AssistantDto } from '../../types/assistantModels';
import './AssistantCard.css';

const TYPE_ICON: Record<AssistantDto['type'], IconName> = {
  system: 'shield',
  owned: 'user',
  shared: 'people',
};

interface AssistantCardProps {
  assistant: AssistantDto;
  selected: boolean;
  /** Shown but not selectable, with this text as the reason. */
  disabledReason?: string;
  onSelect: (assistant: AssistantDto) => void;
}

/** A selectable assistant with its description and a list of its model, classification and capabilities. */
export default function AssistantCard({ assistant, selected, disabledReason, onSelect }: AssistantCardProps) {
  useSignals();
  const { t } = useTranslation();
  const models = getModels().value ?? [];
  const capabilities = capabilitiesOf(assistant, models);
  const activeCapabilities = CAPABILITIES.filter(({ key }) => capabilities[key]);
  const modelName = models.find(m => m.id === assistant.modelId)?.modelName;
  const description = assistant.description?.trim();
  const disabled = disabledReason !== undefined;

  return (
    <Card
      role="option"
      tabIndex={disabled ? -1 : 0}
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      title={disabledReason}
      padding="lg"
      gap="md"
      interactive={!disabled}
      selected={selected}
      className={cx('assistant-card', disabled && 'assistant-card--disabled')}
      onClick={() => { if (!disabled) onSelect(assistant); }}
      onKeyDown={(e) => {
        if (!disabled && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(assistant);
        }
      }}
    >
      <div className="assistant-card-top">
        <div className="assistant-card-heading">
          <span className="assistant-card-name">{assistant.name}</span>
          <span className="assistant-card-type">
            <Icon name={TYPE_ICON[assistant.type] ?? 'assistants'} size="xs" color="accent" />
            {t(`assistants.picker.categories.${assistant.type}`)}
          </span>
        </div>
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
      </div>

      <p className="assistant-card-description">{description}</p>

      <dl className="assistant-card-specs">
        <dt>{t('assistantCard.model')}</dt>
        <dd>{modelName ? <span className="assistant-card-model">{modelName}</span> : '–'}</dd>
        <dt>{t('assistantCard.classification')}</dt>
        <dd><ClassificationBadge classification={assistant.classification} /></dd>
        <dt>{t('assistantCard.capabilities')}</dt>
        <dd>
          {activeCapabilities.length > 0 ? (
            <span className="assistant-card-cap-icons">
              {activeCapabilities.map(({ key, icon }) => (
                <Icon key={key} name={icon} size="small" color="accent" label={t(`assistants.capabilities.${key}`)} />
              ))}
            </span>
          ) : '–'}
        </dd>
      </dl>
    </Card>
  );
}
