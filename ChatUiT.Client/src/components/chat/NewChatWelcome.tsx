import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useSignals } from '@preact/signals-react/runtime';
import { getUserProfile } from '../../services/userProfileService';
import { getRecentAssistants, getCurrentAssistantId, setUserSelectedAssistantId, getRedEnabled } from '../../services/chatService';
import AssistantRow from '../common/AssistantRow';
import Card from '../common/Card';
import Grid from '../common/Grid';
import './NewChatWelcome.css';

export default function NewChatWelcome() {
  const { t } = useTranslation();
  const { account } = useAuth();
  useSignals();
  const profileName = getUserProfile().value?.displayName ?? '';
  const recentAssistants = getRecentAssistants().value;
  const currentAssistantId = getCurrentAssistantId().value;
  const redEnabled = getRedEnabled().value;

  const nameParts = (profileName || account?.name || '')
    .split(/[\s,]+/)
    .filter(Boolean);
  // MSAL names may come as "Lastname, Firstname" — pick the part after the comma
  const useLastPart = !profileName && !!account?.name?.includes(',');
  const firstName = nameParts[useLastPart ? nameParts.length - 1 : 0];

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

        <div className="tips-section">
          <div className="t-overline">{t('welcome.tips.title')}</div>
          <Grid minColumnWidth="13.4375rem" gap="sm">
            <Card accent="top" gap="2xs">
              <strong className="t-ui">{t('welcome.tips.selectAssistant.title')}</strong>
              <span className="tip-text t-caption">{t('welcome.tips.selectAssistant.description')}</span>
            </Card>
            <Card accent="top" gap="2xs">
              <strong className="t-ui">{t('welcome.tips.uploadFiles.title')}</strong>
              <span className="tip-text t-caption">{t('welcome.tips.uploadFiles.description')}</span>
            </Card>
            <Card accent="top" gap="2xs">
              <strong className="t-ui">{t('welcome.tips.askQuestions.title')}</strong>
              <span className="tip-text t-caption">{t('welcome.tips.askQuestions.description')}</span>
            </Card>
          </Grid>
        </div>

        {recentAssistants.length > 0 && (
          <div className="tips-section recent-assistants">
            <div className="t-overline">{t('welcome.recentAssistants')}</div>
            <Grid role="listbox" aria-label={t('welcome.recentAssistants')} minColumnWidth="13.4375rem" gap="sm">
              {recentAssistants.map(assistant => (
                <Card key={assistant.id} accent="top" padding="none">
                  <AssistantRow
                    assistant={assistant}
                    selected={assistant.id === currentAssistantId}
                    disabledReason={redEnabled && assistant.classification !== 'Red' ? t('chat.redToggle.assistantNotRed') : undefined}
                    onSelect={a => setUserSelectedAssistantId(a.id)}
                  />
                </Card>
              ))}
            </Grid>
          </div>
        )}
      </div>
    </div>
  );
}
