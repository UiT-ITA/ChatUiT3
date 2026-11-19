import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '../common/Icon';
import IconButton from '../common/IconButton';
import Badge from '../common/Badge';
import Card from '../common/Card';
import ClassificationBadge from '../classification/ClassificationBadge';
import CapabilityTag from './CapabilityTag';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui-sdk/react/tooltip';
import type { Capability } from './assistantCapabilities';
import { cx, spacePx } from '../common/layout';
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
  onToggleFavorite: (assistant: AssistantDto) => void;
  /** The name of the assistant's model, shown at the start of the specs line. */
  modelName?: string;
  /** Shows the default badge, for the assistant the user chose as default. */
  isDefault?: boolean;
  /** Shows a hidden icon, for an assistant hidden from the picker. */
  hidden?: boolean;
  /** Shows the assistant's type under the name. */
  showType?: boolean;
  /** Number of knowledge files, shown after the model when above zero. */
  fileCount?: number;
  /** Capabilities shown as icon and name at the end of the specs line. */
  capabilities?: Capability[];
  /** Smaller padding and a one-line description. */
  compact?: boolean;
  /** Shows a chevron, or a check when selected, at the end of the specs line. */
  showAction?: boolean;
}

/** Marks the assistant the user chose as default, muted when its model can no longer be default. */
export function DefaultBadge({ canBeDefault, className }: { canBeDefault: boolean; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge
      tone={canBeDefault ? 'accent' : 'neutral'}
      title={canBeDefault ? t('assistants.actions.isDefault') : t('assistants.defaultInactiveNote')}
      className={className}
    >
      {t('assistants.defaultBadge')}
    </Badge>
  );
}

/** A selectable assistant with its description, and its model, classification and capabilities on one line. */
export default function AssistantCard({ assistant, selected, disabledReason, onSelect, onToggleFavorite, modelName, isDefault = false, hidden = false, showType = true, fileCount = 0, capabilities = [], compact = false, showAction = false }: AssistantCardProps) {
  const { t } = useTranslation();
  const description = assistant.description?.trim();
  const disabled = disabledReason !== undefined;
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  return (
    <Card
      title={disabledReason}
      padding={compact ? 'md' : 'lg'}
      gap={compact ? 'sm' : 'md'}
      interactive={!disabled}
      selected={selected}
      className={cx('assistant-card', compact && 'assistant-card--compact', disabled && 'assistant-card--disabled')}
      onClick={() => { if (!disabled) onSelect(assistant); }}
    >
      <div className="assistant-card-top">
        <div className="assistant-card-heading">
          <button type="button" className="assistant-card-select assistant-card-title" title={assistant.name} aria-current={selected || undefined} disabled={disabled}>{assistant.name}</button>
          {showType && (
            <span className="assistant-card-type">
              <Icon name={TYPE_ICON[assistant.type] ?? 'assistants'} size="sm" color="secondary" />
              {t(`assistants.picker.categories.${assistant.type}`)}
            </span>
          )}
        </div>
        {isDefault && <DefaultBadge canBeDefault={assistant.canBeDefault} className="assistant-card-default" />}
        {hidden && <Icon name="hidden" color="muted" label={t('assistants.actions.showInSelector')} />}
        <IconButton
          icon={<Icon name={assistant.isFavorite ? 'star' : 'starOutline'} color={assistant.isFavorite ? 'accent' : 'secondary'} />}
          label={assistant.isFavorite
            ? t('assistants.actions.removeFavorite')
            : t('assistants.actions.addFavorite')}
          size="small"
          aria-pressed={assistant.isFavorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(assistant);
          }}
        />
      </div>

      {description ? (
        // The tooltip shows the whole description only while the line clamp cuts it off
        <Tooltip
          type="label"
          onOpenChange={(open, details) => {
            const element = descriptionRef.current;
            if (open && element && element.scrollHeight <= element.clientHeight) details.cancel();
          }}
        >
          <TooltipTrigger render={<p ref={descriptionRef} className="assistant-card-description" />}>{description}</TooltipTrigger>
          <TooltipContent align="start" sideOffset={spacePx('sm')} className="t-caption">{description}</TooltipContent>
        </Tooltip>
      ) : (
        <p className="assistant-card-description assistant-card-description--empty">{t('assistants.noDescription')}</p>
      )}

      <div className="assistant-card-specs">
        {(modelName || fileCount > 0) && (
          <span className="assistant-card-model" title={t('assistantCard.model')}>
            {[modelName, fileCount > 0 ? t('assistants.fileCount', { count: fileCount }) : undefined].filter(Boolean).join(' · ')}
          </span>
        )}
        <ClassificationBadge classification={assistant.classification} />
        {capabilities.length > 0 && (
          <span className="assistant-card-cap-icons">
            {capabilities.map(key => (
              <CapabilityTag key={key} capability={key} />
            ))}
          </span>
        )}
        {showAction && !disabled && (
          <span className={cx('assistant-card-action', selected && 'assistant-card-action--selected')}>
            {selected
              ? <Icon name="check" size="sm" label={t('welcome.assistantSelected')} className="assistant-card-action__icon" />
              : <Icon name="chevronRight" size="md" label={t('welcome.useAssistant')} className="assistant-card-action__icon" />}
          </span>
        )}
      </div>
    </Card>
  );
}
