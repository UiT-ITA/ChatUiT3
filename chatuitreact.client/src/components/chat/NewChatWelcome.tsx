import { useState, useRef, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Icon';
import { getSelectableAssistants, getCurrentAssistantId } from '../../services/chatService';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import AssistantDropdown from '../common/AssistantDropdown';
import './NewChatWelcome.css';

export default function NewChatWelcome() {
  useSignals();
  const { t } = useTranslation();
  const { account } = useAuth();
  const { settings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectableAssistants = getSelectableAssistants().value || [];
  const currentAssistantId = getCurrentAssistantId().value;
  const selectedAssistant = selectableAssistants.find(a => a.id === currentAssistantId) || selectableAssistants[0];

  const nameParts = (settings.userName || account?.name || '')
    .split(/[\s,]+/)
    .filter(Boolean);
  // MSAL names may come as "Lastname, Firstname" — pick the part after the comma
  const useLastPart = !settings.userName && !!account?.name?.includes(',');
  const firstName = nameParts[useLastPart ? nameParts.length - 1 : 0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="new-chat-welcome">
      <div className="welcome-container">
        <div className="welcome-hero">
          <div className="welcome-hero-stripe-gap" />
          <div className="welcome-hero-stripe" />
          <div className="welcome-hero-content">
            <div className="welcome-hero-overline t-overline">ChatUiT</div>
            <h1 className="welcome-hero-title t-hero">
              {firstName ? t('welcome.greeting', { name: firstName }) : t('welcome.header')}
            </h1>
            <p className="welcome-hero-sub t-body">{t('welcome.subheader')}</p>
          </div>
        </div>

        <div className="assistant-section">
          <label className="t-overline">{t('welcome.chooseAssistant')}</label>
          <div className="assistant-dropdown-container" ref={dropdownRef}>
            <button
              type="button"
              className="assistant-dropdown-button t-ui"
              onClick={() => setIsOpen(!isOpen)}
              title={t('welcome.selectAssistant')}
            >
              <span className="assistant-name">{selectedAssistant?.name || t('assistants.defaultAssistant')}</span>
              <Icon
                name={isOpen ? "arrowUp" : "arrowDown"}
                size={1}
                className="expand-icon"
              />
            </button>
            <AssistantDropdown
              isOpen={isOpen}
              direction="below"
              onClose={() => setIsOpen(false)}
            />
          </div>
        </div>

        <div className="tips-section">
          <div className="t-overline">{t('welcome.tips.title')}</div>
          <div className="tips-container">
            <div className="tip-card">
              <strong className="t-ui">{t('welcome.tips.selectAssistant.title')}</strong>
              <p className="t-caption">{t('welcome.tips.selectAssistant.description')}</p>
            </div>
            <div className="tip-card">
              <strong className="t-ui">{t('welcome.tips.uploadFiles.title')}</strong>
              <p className="t-caption">{t('welcome.tips.uploadFiles.description')}</p>
            </div>
            <div className="tip-card">
              <strong className="t-ui">{t('welcome.tips.askQuestions.title')}</strong>
              <p className="t-caption">{t('welcome.tips.askQuestions.description')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
