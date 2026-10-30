import { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import Button from './Button';
import IconButton from './IconButton';
import Popover from './Popover';
import { getSelectableAssistants, getCurrentAssistantId } from '../../services/chatService';
import AssistantDropdown from './AssistantDropdown';

interface AssistantSelectorProps {
  // Shows only the assistant icon, and opens the picker across the nearest positioned ancestor
  compact?: boolean;
}

export default function AssistantSelector({ compact = false }: AssistantSelectorProps) {
  useSignals();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const selectableAssistants = getSelectableAssistants().value || [];
  const currentAssistantId = getCurrentAssistantId().value;
  const selectedAssistant = selectableAssistants.find(a => a.id === currentAssistantId) || selectableAssistants[0];
  const name = selectedAssistant?.name || t('assistants.defaultAssistant');

  return (
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
      placement="top-start"
      anchor={compact ? 'parent' : 'trigger'}
      panelWidth={compact ? 'trigger' : 'xl'}
      minWidth="0"
      trigger={compact ? (
        <IconButton icon="assistants" label={name} variant="subtle" size="small" />
      ) : (
        <Button
          variant="subtle"
          size="small"
          startIcon="assistants"
          endIcon={isOpen ? 'arrowDown' : 'arrowUp'}
          maxWidth="16rem"
          title={t('welcome.selectAssistant')}
        >
          {name}
        </Button>
      )}
    >
      <AssistantDropdown onClose={() => setIsOpen(false)} />
    </Popover>
  );
}
