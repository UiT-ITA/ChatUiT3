import { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from './Icon';
import { getSelectableAssistants, getCurrentAssistantId, setUserSelectedAssistantId, getRedEnabled } from '../../services/chatService';
import { getModels } from '../../services/modelService';
import AssistantRow from './AssistantRow';
import { CAPABILITIES, capabilitiesOf, type Capability } from './assistantCapabilities';
import type { AssistantDto } from '../../types/assistantModels';
import type { UserModelDto } from '../../types/modelModels';
import './AssistantDropdown.css';

interface AssistantDropdownProps {
  isOpen: boolean;
  direction: 'above' | 'below';
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

export default function AssistantDropdown({ isOpen, direction, onClose }: AssistantDropdownProps) {
  useSignals();
  const { t } = useTranslation();
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [capabilityFilter, setCapabilityFilter] = useState<Capability[]>([]);

  const selectableAssistants = getSelectableAssistants().value || [];
  const currentAssistantId = getCurrentAssistantId().value;
  const selectedAssistant = selectableAssistants.find(a => a.id === currentAssistantId) || selectableAssistants[0];

  const modelsSignal = getModels();
  const models: UserModelDto[] = modelsSignal.value ?? [];
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

  if (!isOpen) {
    // The component stays mounted, so transient state has to be reset by hand.
    if (filterOpen) setFilterOpen(false);
    return null;
  }

  const dropdownClass = direction === 'above' ? 'assistant-dropdown-above' : 'assistant-dropdown-below';

  return (
    <div className={`assistant-dropdown ${dropdownClass}`}>
      <div className="ap-search-wrap">
        <div className="ap-search">
          <Icon name="search" size={0.9375} className="ap-search-icon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('assistants.picker.searchPlaceholder')}
            className="t-ui-plain"
            autoFocus
          />
          {query.length > 0 && (
            <button
              type="button"
              className="ap-search-clear"
              onClick={() => setQuery('')}
              title={t('common.clear')}
            >
              <Icon name="close" size={0.875} />
            </button>
          )}
        </div>
        <div className="ap-filter">
          <button
            type="button"
            className={`ap-filter-button ${capabilityFilter.length > 0 ? 'active' : ''}`}
            onClick={() => setFilterOpen(open => !open)}
            title={t('assistants.picker.filterTitle')}
          >
            <Icon name="filter" size={1.125} />
          </button>
          {filterOpen && (
            <div className="ap-filter-popover">
              <div className="ap-filter-title t-overline">{t('assistants.picker.filterTitle')}</div>
              {CAPABILITIES.map(({ key, icon }) => (
                <button
                  type="button"
                  key={key}
                  className={`ap-filter-option t-ui ${capabilityFilter.includes(key) ? 'active' : ''}`}
                  onClick={() => toggleCapabilityFilter(key)}
                >
                  <Icon name={icon} size={1} className="ap-filter-option-icon" />
                  <span className="ap-filter-option-label">{t(`assistants.capabilities.${key}`)}</span>
                  {capabilityFilter.includes(key) && <Icon name="check" size={0.9375} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ap-body" onMouseDown={() => setFilterOpen(false)}>
        <div className="ap-rail">
          {CATEGORIES.map(({ key, icon }, index) => (
            <div key={key} className="ap-rail-slot">
              {index === 1 && <div className="ap-rail-divider" />}
              <button
                type="button"
                className={`ap-rail-item ${category === key ? 'active' : ''}`}
                onClick={() => setCategory(key)}
                title={t(`assistants.picker.categories.${key}`)}
              >
                <Icon name={icon} size={1.125} />
              </button>
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
