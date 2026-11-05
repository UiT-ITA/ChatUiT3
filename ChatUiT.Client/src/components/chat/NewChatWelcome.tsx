import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useSignals } from '@preact/signals-react/runtime';
import { getUserProfile } from '../../services/userProfileService';
import { getRecentAssistants, getCurrentAssistantId, setUserSelectedAssistantId, getRedEnabled } from '../../services/chatService';
import { toggleFavorite } from '../../services/assistantService';
import { getModels } from '../../services/modelService';
import AssistantCard from '../assistants/AssistantCard';
import type { IconName } from '../common/Icon';
import useMediaQuery from '../../hooks/useMediaQuery';
import Stack from '../common/Stack';
import Text from '../common/Text';
import { Tip, TipList } from '../common/TipList';
import BrandHero from './BrandHero';
import CenteredColumn from '../common/CenteredColumn';
import { CardGrid } from '../common/CardGrid';
import { MOBILE } from '../common/breakpoints';

const TIPS: { key: 'selectAssistant' | 'uploadFiles' | 'askQuestions'; icon: IconName }[] = [
  { key: 'selectAssistant', icon: 'assistants' },
  { key: 'uploadFiles', icon: 'attach' },
  { key: 'askQuestions', icon: 'chat' },
];

export default function NewChatWelcome() {
  const { t } = useTranslation();
  const { account } = useAuth();
  useSignals();
  const profileName = getUserProfile().value?.displayName ?? '';
  const recentAssistants = getRecentAssistants().value;
  const currentAssistantId = getCurrentAssistantId().value;
  const redEnabled = getRedEnabled().value;
  const models = getModels().value ?? [];
  const narrow = useMediaQuery(MOBILE);

  const nameParts = (profileName || account?.name || '')
    .split(/[\s,]+/)
    .filter(Boolean);
  // The part after the comma of an account name written "Lastname, Firstname"
  const useLastPart = !profileName && !!account?.name?.includes(',');
  const firstName = nameParts[useLastPart ? nameParts.length - 1 : 0];

  return (
    <Stack gap="none" grow minHeight="0" overflow="y-auto" fade="y">
      <CenteredColumn maxWidth="lg" middle pt="2xl" px="2xl" pb="2xl" mobilePt="xl" mobilePx="lg" mobilePb="xl">
        <Stack gap="2xl" mobileGap="lg">
          <BrandHero
            overline="ChatUiT"
            title={firstName ? t('welcome.greeting', { name: firstName }) : t('welcome.header')}
            subtitle={t('welcome.subheader')}
          />

          <Stack gap="2xl" mobileGap="xl">
            <Stack gap="md" mobileGap="sm">
              <Text as="div" variant="overline">{t('welcome.tips.title')}</Text>
              <TipList>
                {TIPS.map(({ key, icon }) => (
                  <Tip key={key} icon={icon} title={t(`welcome.tips.${key}.title`)} text={t(`welcome.tips.${key}.description`)} />
                ))}
              </TipList>
            </Stack>

            {recentAssistants.length > 0 && (
              <div>
                <Text as="div" variant="overline" mb="md">{t('welcome.recentAssistants')}</Text>
                <CardGrid
                  role="listbox"
                  aria-label={t('welcome.recentAssistants')}
                  cardRows={3}
                  columns={recentAssistants.length}
                  mobileLayout="carousel"
                  fadeX
                  pageDots
                >
                  {recentAssistants.map(assistant => (
                    <AssistantCard
                      key={assistant.id}
                      assistant={assistant}
                      selected={assistant.id === currentAssistantId}
                      disabledReason={redEnabled && assistant.classification !== 'Red' ? t('chat.redToggle.assistantNotRed') : undefined}
                      onSelect={a => setUserSelectedAssistantId(a.id)}
                      onToggleFavorite={a => void toggleFavorite(a.id)}
                      modelName={models.find(m => m.id === assistant.modelId)?.modelName}
                      compact={narrow}
                      showAction
                    />
                  ))}
                </CardGrid>
              </div>
            )}
          </Stack>
        </Stack>
      </CenteredColumn>
    </Stack>
  );
}
