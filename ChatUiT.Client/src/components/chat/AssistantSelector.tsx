import { Fragment, useEffect, useId, useRef, useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import Box from '../common/Box';
import Button from '../common/Button';
import { Icon, type IconName } from '../common/Icon';
import IconButton from '../common/IconButton';
import { ListboxOption } from '../common/Listbox';
import { Menu, MenuItem } from '../common/Menu';
import Popover from '../common/Popover';
import SearchField from '../common/SearchField';
import Stack from '../common/Stack';
import Text from '../common/Text';
import Tooltip from '../common/Tooltip';
import ClassificationBadge from '../classification/ClassificationBadge';
import { CAPABILITIES, capabilityKeys, type Capability } from '../assistants/assistantCapabilities';
import { getSelectableAssistants, getCurrentAssistantId, setUserSelectedAssistantId, getRedEnabled } from '../../services/chatService';
import { toggleFavorite } from '../../services/assistantService';
import { getModels } from '../../services/modelService';
import type { AssistantDto } from '../../types/assistantModels';
import './AssistantSelector.css';

type Category = 'all' | 'favorites' | 'system' | 'owned' | 'shared';

const CATEGORIES: { key: Category; icon: IconName }[] = [
  { key: 'all', icon: 'grid' },
  { key: 'favorites', icon: 'star' },
  { key: 'system', icon: 'shield' },
  { key: 'owned', icon: 'user' },
  { key: 'shared', icon: 'people' },
];

const EMPTY_KEYS: Record<Category, string> = {
  all: 'assistants.picker.noResults',
  favorites: 'assistants.picker.noFavorites',
  system: 'assistants.emptyStates.noSystemAssistants',
  owned: 'assistants.emptyStates.noPersonalAssistants',
  shared: 'assistants.emptyStates.noSharedAssistants',
};

/** The composer's assistant button, which opens the assistant picker. A narrow composer shows only its icon (Composer.css). */
export default function AssistantSelector() {
  useSignals();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const assistants = getSelectableAssistants().value || [];
  const currentAssistantId = getCurrentAssistantId().value;
  const selected = assistants.find(a => a.id === currentAssistantId) || assistants[0];
  const name = selected?.name || t('assistants.defaultAssistant');

  return (
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
      openOn="hover"
      placement="top-start"
      panelWidth="xl"
      minWidth="0"
      className="assistant-selector composer-toolbar__popover"
      trigger={(
        <Button
          variant="subtle"
          size="small"
          startIcon="assistants"
          maxWidth="xs"
          title={t('welcome.selectAssistant')}
          aria-label={name}
        >
          <span className="assistant-selector__label">
            {name}
            <Icon name="arrowUp" size="sm" className="assistant-selector__arrow" />
          </span>
        </Button>
      )}
    >
      {close => <AssistantPicker assistants={assistants} selectedId={selected?.id} close={close} pin={() => setIsOpen(true)} focusSearch={isOpen} />}
    </Popover>
  );
}

interface AssistantPickerProps {
  assistants: AssistantDto[];
  selectedId?: string;
  close: () => void;
  // Keeps the picker open after the pointer leaves
  pin: () => void;
  focusSearch: boolean;
}

/** The picker: search, capability filter, categories and the list. A click or typing inside pins it open. */
function AssistantPicker({ assistants, selectedId, close, pin, focusSearch }: AssistantPickerProps) {
  useSignals();
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState<Capability[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const models = getModels().value ?? [];
  const redEnabled = getRedEnabled().value;

  useEffect(() => {
    if (focusSearch) searchRef.current?.focus();
  }, [focusSearch]);

  const needle = query.trim().toLowerCase();
  const visibleAssistants = assistants.filter(assistant =>
    (category === 'all' || (category === 'favorites' ? assistant.isFavorite : assistant.type === category))
    && (!needle || [assistant.name, assistant.description ?? '', ...assistant.tags].some(field => field.toLowerCase().includes(needle)))
    && capabilityFilter.every(capability => capabilityKeys(assistant, models).includes(capability))
  );

  return (
    <div onClickCapture={pin}>
      <Stack direction="row" align="center" gap="sm" py="sm" px="lg" border borderSide="bottom" shrink={false}>
        <SearchField
          ref={searchRef}
          size="medium"
          value={query}
          onChange={value => {
            setQuery(value);
            pin();
          }}
          placeholder={t('assistants.picker.searchPlaceholder')}
        />
        <Popover
          placement="bottom-end"
          trigger={<IconButton icon="filter" label={t('assistants.picker.filterTitle')} active={capabilityFilter.length > 0} />}
          title={t('assistants.picker.filterTitle')}
        >
          <Menu>
            {CAPABILITIES.map(({ key, icon }) => (
              <MenuItem
                key={key}
                icon={icon}
                selected={capabilityFilter.includes(key)}
                onClick={() => setCapabilityFilter(current => current.includes(key) ? current.filter(c => c !== key) : [...current, key])}
              >
                {t(`assistants.capabilities.${key}`)}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </Stack>

      <Stack direction="row" gap="sm" p="md">
        <div className="assistant-selector__rail">
          {CATEGORIES.map(({ key, icon }, index) => (
            <Fragment key={key}>
              {index === 1 && <Box mx="sm" my="xs" border borderSide="top" />}
              <IconButton
                icon={icon}
                label={t(`assistants.picker.categories.${key}`)}
                size="large"
                active={category === key}
                mx="xs"
                my="xs"
                onClick={() => setCategory(key)}
              />
            </Fragment>
          ))}
        </div>

        <div className="assistant-selector__list" role="listbox" aria-label={t('welcome.selectAssistant')}>
          {visibleAssistants.length === 0 && (
            <div className="assistant-selector__empty t-ui-plain">{t(needle || capabilityFilter.length > 0 ? EMPTY_KEYS.all : EMPTY_KEYS[category])}</div>
          )}

          {visibleAssistants.map(assistant => {
            const modelName = models.find(m => m.id === assistant.modelId)?.modelName;
            const capabilities = capabilityKeys(assistant, models);
            const description = assistant.description || t('assistants.noDescriptionAvailable');
            const disabledReason = redEnabled && assistant.classification !== 'Red' ? t('chat.redToggle.assistantNotRed') : undefined;
            return (
              <ListboxOption
                key={assistant.id}
                className="assistant-selector__row"
                selected={selectedId === assistant.id}
                disabled={disabledReason !== undefined}
                title={disabledReason}
                aria-describedby={`${descriptionId}-${assistant.id}`}
                onClick={() => {
                  setUserSelectedAssistantId(assistant.id);
                  close();
                }}
                leading={(
                  <span className="assistant-selector__row-leading">
                    <Icon name={CATEGORIES.find(category => category.key === assistant.type)?.icon ?? 'assistants'} color="muted" />
                  </span>
                )}
                description={(
                  <span className="assistant-selector__row-line">
                    {modelName && (
                      <>
                        <Text variant="meta" tone="muted" truncate>{modelName}</Text>
                        <span className="assistant-selector__separator" aria-hidden="true" />
                      </>
                    )}
                    <ClassificationBadge classification={assistant.classification} />
                    {capabilities.length > 0 && (
                      <>
                        <span className="assistant-selector__separator" aria-hidden="true" />
                        <Stack direction="row" gap="sm" align="center" shrink={false}>
                          {CAPABILITIES.filter(({ key }) => capabilities.includes(key)).map(({ key, icon }) => (
                            <Icon key={key} name={icon} color="accent" label={t(`assistants.capabilities.${key}`)} />
                          ))}
                        </Stack>
                      </>
                    )}
                    <Tooltip content={description} focusable className="assistant-selector__row-end">
                      <Icon name="info" color="muted" label={description} />
                    </Tooltip>
                    <span id={`${descriptionId}-${assistant.id}`} hidden>{description}</span>
                  </span>
                )}
              >
                <span className="assistant-selector__row-line">
                  <Text variant="body-strong" truncate grow>{assistant.name}</Text>
                  <IconButton
                    className="assistant-selector__row-end"
                    icon={<Icon name={assistant.isFavorite ? 'star' : 'starOutline'} color={assistant.isFavorite ? 'accent' : 'muted'} />}
                    label={t(assistant.isFavorite ? 'assistants.actions.removeFavorite' : 'assistants.actions.addFavorite')}
                    size="small"
                    aria-pressed={assistant.isFavorite}
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleFavorite(assistant.id);
                    }}
                  />
                </span>
              </ListboxOption>
            );
          })}
        </div>
      </Stack>
    </div>
  );
}
