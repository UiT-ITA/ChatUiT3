import { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import type { IconName } from './Icon';
import IconButton from './IconButton';
import { getSelectableAssistants, getCurrentAssistantId, setUserSelectedAssistantId, getRedEnabled } from '../../services/chatService';
import { getModels } from '../../services/modelService';
import AssistantRow from './AssistantRow';
import SearchField from './SearchField';
import Popover from './Popover';
import { Menu, MenuItem } from './Menu';
import { CAPABILITIES, capabilitiesOf, type Capability } from './assistantCapabilities';
import type { AssistantDto } from '../../types/assistantModels';
import type { UserLanguageModelDto } from '../../types/modelModels';
import './AssistantDropdown.css';

interface AssistantDropdownProps {
  onClose?: () => void;
}

type Category = 'all' | 'favorites' | 'system' | 'owned' | 'shared';

const CATEGORIES: { key: Category; icon: IconName }[] = [
  { key: 'all', icon: 'grid' },
  { key: 'favorites', icon: 'star' },
  { key: 'system', icon: 'shield' },
  { key: 'owned', icon: 'user' },
  { key: 'shared', icon: 'people' },
];

/** The content of the assistant picker: search, filters, categories and the list. */
export default function AssistantDropdown({ onClose }: AssistantDropdownProps) {
  useSignals();
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [capabilityFilter, setCapabilityFilter] = useState<Capability[]>([]);

  const selectableAssistants = getSelectableAssistants().value || [];
  const currentAssistantId = getCurrentAssistantId().value;
  const selectedAssistant = selectableAssistants.find(a => a.id === currentAssistantId) || selectableAssistants[0];

  const modelsSignal = getModels();
  const models: UserLanguageModelDto[] = modelsSignal.value ?? [];
  const redEnabled = getRedEnabled().value;

  const handleSelectAssistant = (assistant: AssistantDto) => {
    setUserSelectedAssistantId(assistant.id);
    if (onClose) {
      onClose();
    }
  };

  const toggleCapabilityFilter = (capability: Capability) => {
    setCapabilityFilter(current =>
      current.includes(capability)
        ? current.filter(c => c !== capability)
        : [...current, capability]
    );
  };

  const matchesCategory = (assistant: AssistantDto) => {
    if (category === 'all') return true;
    if (category === 'favorites') return assistant.isFavorite;
    return assistant.type === category;
  };

  const matchesQuery = (assistant: AssistantDto) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [assistant.name, assistant.description ?? '', ...assistant.tags]
      .some(field => field.toLowerCase().includes(needle));
  };

  const matchesCapabilities = (assistant: AssistantDto) => {
    if (capabilityFilter.length === 0) return true;
    const capabilities = capabilitiesOf(assistant, models);
    return capabilityFilter.every(capability => capabilities[capability]);
  };

  const visibleAssistants = selectableAssistants.filter(
    a => matchesCategory(a) && matchesQuery(a) && matchesCapabilities(a)
  );

  const emptyMessage = () => {
    if (query.trim() || capabilityFilter.length > 0) return t('assistants.picker.noResults');
    switch (category) {
      case 'favorites': return t('assistants.picker.noFavorites');
      case 'system': return t('assistants.emptyStates.noSystemAssistants');
      case 'owned': return t('assistants.emptyStates.noPersonalAssistants');
      case 'shared': return t('assistants.emptyStates.noSharedAssistants');
      default: return t('assistants.picker.noResults');
    }
  };

  return (
    <div className="assistant-dropdown">
      <div className="ap-search-wrap">
        <SearchField
          size="medium"
          value={query}
          onChange={setQuery}
          placeholder={t('assistants.picker.searchPlaceholder')}
          autoFocus
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
                onClick={() => toggleCapabilityFilter(key)}
              >
                {t(`assistants.capabilities.${key}`)}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </div>

      <div className="ap-body">
        <div className="ap-rail">
          {CATEGORIES.map(({ key, icon }, index) => (
            <div key={key} className="ap-rail-slot">
              {index === 1 && <div className="ap-rail-divider" />}
              <IconButton
                icon={icon}
                label={t(`assistants.picker.categories.${key}`)}
                size="large"
                active={category === key}
                mx="xs"
                my="2xs"
                onClick={() => setCategory(key)}
              />
            </div>
          ))}
        </div>

        <div className="ap-list" role="listbox" aria-label={t('welcome.selectAssistant')}>
          {visibleAssistants.length === 0 && (
            <div className="ap-empty t-ui-plain">{emptyMessage()}</div>
          )}

          {visibleAssistants.map((assistant) => (
            <AssistantRow
              key={assistant.id}
              assistant={assistant}
              selected={selectedAssistant?.id === assistant.id}
              disabledReason={redEnabled && assistant.classification !== 'Red' ? t('chat.redToggle.assistantNotRed') : undefined}
              onSelect={handleSelectAssistant}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
