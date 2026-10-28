import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import ClassificationBadge from '../common/ClassificationBadge';
import ComposerPopover from './ComposerPopover';
import { getCurrentAssistantId, getCurrentChatId, getRedEnabled, toggleRed } from '../../services/chatService';
import { getAssistant } from '../../services/assistantService';
import { chatClassification, DATA_CLASSIFICATIONS } from '../../types/modelModels';
import './ChatClassification.css';

/** The classification of the conversation. With a red assistant it opens the switch that allows red data. */
export default function ChatClassification() {
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
    <ComposerPopover
      className="chat-classification composer-popover--panel"
      trigger={<ClassificationBadge classification={classification} showTitle={false} />}
      label={t('classification.title', { level: t(`classification.${classification}`) })}
    >
      <div className="composer-popover-title t-overline">{t('classification.heading')}</div>
      <ul className="chat-classification-levels">
        {DATA_CLASSIFICATIONS.map(level => (
          <li
            key={level}
            className={`chat-classification-level t-hint ${level === classification ? 'current' : ''}`}
            aria-current={level === classification ? 'true' : undefined}
          >
            <ClassificationBadge classification={level} showTitle={false} />
            <span className="chat-classification-description">{t(`classification.descriptions.${level}`)}</span>
          </li>
        ))}
      </ul>
      <label className="chat-red-toggle t-ui">
        {t('chat.redToggle.label')}
        <button
          type="button"
          className={`chat-red-toggle-pill ${redEnabled ? 'on' : ''}`}
          onClick={() => { void toggleRed(); }}
          disabled={redLocked}
          aria-pressed={redEnabled}
          aria-label={t('chat.redToggle.label')}
        >
          <span className="chat-red-toggle-knob" />
        </button>
      </label>
      <div className="chat-red-toggle-hint t-hint">{t(redEnabled ? 'chat.redToggle.enabled' : 'chat.redToggle.enable')}</div>
    </ComposerPopover>
  );
}
