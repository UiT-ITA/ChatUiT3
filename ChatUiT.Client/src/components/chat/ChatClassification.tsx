import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import ClassificationBadge from '../common/ClassificationBadge';
import IconButton from '../common/IconButton';
import Popover, { PopoverBody } from '../common/Popover';
import Toggle from '../common/Toggle';
import { getCurrentAssistantId, getCurrentChatId, getRedEnabled, toggleRed } from '../../services/chatService';
import { getAssistant } from '../../services/assistantService';
import { chatClassification, DATA_CLASSIFICATIONS } from '../../types/modelModels';
import './ChatClassification.css';

/** The classification of the conversation. With a red assistant it opens the switch that allows red data. */
interface ChatClassificationProps {
  // What the popover lines up with: its trigger, or the toolbar
  popoverAnchor?: 'trigger' | 'parent';
}

export default function ChatClassification({ popoverAnchor = 'trigger' }: ChatClassificationProps) {
  useSignals();
  const { t } = useTranslation();

  const currentAssistantId = getCurrentAssistantId().value;
  const assistant = currentAssistantId ? getAssistant(currentAssistantId).value : undefined;
  const redEnabled = getRedEnabled().value;
  const redLocked = redEnabled && getCurrentChatId().value !== undefined;

  if (!assistant) return null;

  const classification = chatClassification(assistant.classification, redEnabled);
  if (assistant.classification !== 'Red') {
    return <div className="chat-classification"><ClassificationBadge classification={classification} /></div>;
  }

  return (
    <Popover
      anchor={popoverAnchor}
      openOn="hover"
      placement="top-start"
      panelWidth="large"
      trigger={(
        <IconButton
          icon={<ClassificationBadge classification={classification} showTitle={false} />}
          label={t('classification.title', { level: t(`classification.${classification}`) })}
          size="small"
        />
      )}
      title={t('classification.heading')}
    >
      <PopoverBody>
        <ul className="chat-classification-levels">
          {DATA_CLASSIFICATIONS.map(level => (
            <li
              key={level}
              className={`chat-classification-level t-hint ${level === classification ? 'current' : ''}`}
              aria-current={level === classification ? 'true' : undefined}
            >
              <ClassificationBadge classification={level} showTitle={false} strong={level === classification} />
              <span className="chat-classification-description">{t(`classification.descriptions.${level}`)}</span>
            </li>
          ))}
        </ul>
        <div className="chat-red-toggle">
          <Toggle
            checked={redEnabled}
            onChange={() => { void toggleRed(); }}
            label={t('chat.redToggle.label')}
            tone="critical"
            disabled={redLocked}
            aria-label={t('chat.redToggle.label')}
          />
          <div className="chat-red-toggle-hint t-hint">{t(redEnabled ? 'chat.redToggle.enabled' : 'chat.redToggle.enable')}</div>
        </div>
      </PopoverBody>
    </Popover>
  );
}
