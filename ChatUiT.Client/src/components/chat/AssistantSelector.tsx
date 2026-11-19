import { Fragment, useId, useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import Box from '../common/Box';
import Button from '../common/Button';
import { Icon, type IconName } from '../common/Icon';
import IconButton from '../common/IconButton';
import { OptionContent } from '../common/Listbox';
import { Listbox, ListboxItem } from '@ui-sdk/react/listbox';
import { Toggle, ToggleGroup } from '@ui-sdk/react/toggle';
import { Menu, MenuCheckboxItem, MenuContent, MenuGroup, MenuGroupLabel, MenuItemIcon, MenuItemIndicator, MenuTrigger } from '@ui-sdk/react/menu';
import { Popover, PopoverContent, PopoverTrigger } from '@ui-sdk/react/popover';
import { floatingPanelClass } from '../common/floatingPanel';
import { spacePx } from '../common/layout';
import SearchField from '../common/SearchField';
import Stack from '../common/Stack';
import Text from '../common/Text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@ui-sdk/react/tooltip';
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
    <Popover open={isOpen} onOpenChange={setIsOpen} openOnHover>
      <PopoverTrigger
        render={(
          <Button
            variant="subtle"
            size="small"
            startIcon="assistants"
            maxWidth="xs"
            title={t('welcome.selectAssistant')}
            aria-label={name}
          />
        )}
      >
        <span className="assistant-selector__label">
          {name}
          <Icon name="arrowUp" size="sm" className="assistant-selector__arrow" />
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={spacePx('sm')} className={floatingPanelClass('xl')} aria-label={t('welcome.selectAssistant')}>
        <AssistantPicker assistants={assistants} selectedId={selected?.id} close={() => setIsOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

interface AssistantPickerProps {
  assistants: AssistantDto[];
  selectedId?: string;
  close: () => void;
}

/** The picker: search, capability filter, categories and the list. */
function AssistantPicker({ assistants, selectedId, close }: AssistantPickerProps) {
  useSignals();
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState<Capability[]>([]);
  const descriptionId = useId();
  const models = getModels().value ?? [];
  const redEnabled = getRedEnabled().value;

  const needle = query.trim().toLowerCase();
  const visibleAssistants = assistants.filter(assistant =>
    (category === 'all' || (category === 'favorites' ? assistant.isFavorite : assistant.type === category))
    && (!needle || [assistant.name, assistant.description ?? '', ...assistant.tags].some(field => field.toLowerCase().includes(needle)))
    && capabilityFilter.every(capability => capabilityKeys(assistant, models).includes(capability))
  );

  return (
    <div>
      <Stack direction="row" align="center" gap="sm" py="sm" px="lg" border borderSide="bottom" shrink={false}>
        <SearchField
          size="medium"
          value={query}
          onChange={setQuery}
          placeholder={t('assistants.picker.searchPlaceholder')}
        />
        <Menu>
          <MenuTrigger render={<IconButton icon="filter" label={t('assistants.picker.filterTitle')} active={capabilityFilter.length > 0} />} />
          <MenuContent side="bottom" align="end" sideOffset={spacePx('sm')} className={floatingPanelClass()}>
            <MenuGroup>
              <MenuGroupLabel className="popover__title t-overline">{t('assistants.picker.filterTitle')}</MenuGroupLabel>
              {CAPABILITIES.map(({ key, icon }) => (
                <MenuCheckboxItem
                  key={key}
                  value={key}
                  checked={capabilityFilter.includes(key)}
                  onCheckedChange={checked => setCapabilityFilter(current => checked ? [...current, key] : current.filter(c => c !== key))}
                >
                  <MenuItemIcon><Icon name={icon} size="sm" /></MenuItemIcon>
                  {t(`assistants.capabilities.${key}`)}
                  <MenuItemIndicator><Icon name="check" size="sm" /></MenuItemIndicator>
                </MenuCheckboxItem>
              ))}
            </MenuGroup>
          </MenuContent>
        </Menu>
      </Stack>

      <Stack direction="row" gap="sm" p="md">
        <ToggleGroup
          className="assistant-selector__rail"
          orientation="vertical"
          deselectable={false}
          value={[category]}
          onValueChange={value => { if (value[0]) setCategory(value[0] as Category); }}
        >
          {CATEGORIES.map(({ key, icon }, index) => (
            <Fragment key={key}>
              {index === 1 && <Box mx="sm" my="xs" border borderSide="top" />}
              <Toggle
                value={key}
                render={<IconButton icon={icon} label={t(`assistants.picker.categories.${key}`)} size="large" active={category === key} mx="xs" my="xs" />}
              />
            </Fragment>
          ))}
        </ToggleGroup>

        <div className="assistant-selector__list">
          {visibleAssistants.length === 0 ? (
            <div className="assistant-selector__empty t-ui-plain">{t(needle || capabilityFilter.length > 0 ? EMPTY_KEYS.all : EMPTY_KEYS[category])}</div>
          ) : (
            <div className="assistant-selector__rows">
              <Listbox
                className="assistant-selector__options"
                aria-label={t('welcome.selectAssistant')}
                activation="manual"
                value={selectedId ?? null}
                onValueChange={id => {
                  if (!id) return;
                  setUserSelectedAssistantId(id as string);
                  close();
                }}
              >
                {visibleAssistants.map(assistant => {
                  const modelName = models.find(m => m.id === assistant.modelId)?.modelName;
                  const capabilities = capabilityKeys(assistant, models);
                  const disabledReason = redEnabled && assistant.classification !== 'Red' ? t('chat.redToggle.assistantNotRed') : undefined;
                  return (
                    <ListboxItem
                      key={assistant.id}
                      value={assistant.id}
                      label={assistant.name}
                      className="assistant-selector__row"
                      disabled={disabledReason !== undefined}
                      title={disabledReason}
                      aria-describedby={`${descriptionId}-${assistant.id}`}
                    >
                      <OptionContent
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
                            <span id={`${descriptionId}-${assistant.id}`} hidden>{assistant.description || t('assistants.noDescriptionAvailable')}</span>
                          </span>
                        )}
                      >
                        <span className="assistant-selector__row-line">
                          <Text variant="body-strong" truncate grow>{assistant.name}</Text>
                        </span>
                      </OptionContent>
                    </ListboxItem>
                  );
                })}
              </Listbox>

              <div className="assistant-selector__actions">
                {visibleAssistants.map(assistant => {
                  const description = assistant.description || t('assistants.noDescriptionAvailable');
                  return (
                    <div key={assistant.id} className="assistant-selector__actions-row">
                      <IconButton
                        icon={<Icon name={assistant.isFavorite ? 'star' : 'starOutline'} color={assistant.isFavorite ? 'accent' : 'muted'} />}
                        label={t(assistant.isFavorite ? 'assistants.actions.removeFavorite' : 'assistants.actions.addFavorite')}
                        size="small"
                        aria-pressed={assistant.isFavorite}
                        onClick={() => { void toggleFavorite(assistant.id); }}
                      />
                      <Tooltip type="label">
                        <TooltipTrigger className="assistant-selector__info">
                          <Icon name="info" color="muted" />
                        </TooltipTrigger>
                        <TooltipContent align="end" sideOffset={spacePx('sm')} className="t-caption">{description}</TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Stack>
    </div>
  );
}
