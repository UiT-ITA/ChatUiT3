import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useSignals } from '@preact/signals-react/runtime';
import { getUserProfile } from '../../services/userProfileService';
import { getRecentAssistants, getCurrentAssistantId, setUserSelectedAssistantId, getRedEnabled } from '../../services/chatService';
import { toggleFavorite } from '../../services/assistantService';
import { getModels } from '../../services/modelService';
import AssistantCard from '../assistants/AssistantCard';
import type { IconName } from '../common/Icon';
import Stack from '../common/Stack';
import Text from '../common/Text';
import { Tip, TipList } from '../common/TipList';
import BrandHero from './BrandHero';
import CenteredColumn from '../common/CenteredColumn';
import { CardGrid } from '../common/CardGrid';
import { scrollFadeClass } from '../common/scrollFade';
import { Carousel, CarouselContent, CarouselIndicator, CarouselIndicatorGroup, CarouselItem, CarouselViewport } from '@ui-sdk/react/carousel';
import useMediaQuery from '../../hooks/useMediaQuery';
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
  const isNarrow = useMediaQuery(MOBILE);

  const cards = recentAssistants.map(assistant => (
    <AssistantCard
      key={assistant.id}
      assistant={assistant}
      selected={assistant.id === currentAssistantId}
      disabledReason={redEnabled && assistant.classification !== 'Red' ? t('chat.redToggle.assistantNotRed') : undefined}
      onSelect={a => setUserSelectedAssistantId(a.id)}
      onToggleFavorite={a => void toggleFavorite(a.id)}
      modelName={models.find(m => m.id === assistant.modelId)?.modelName}
      compact
      showAction
    />
  ));

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
              <Stack gap="md" mobileGap="sm">
                <Text as="div" variant="overline">{t('welcome.recentAssistants')}</Text>
                {isNarrow ? (
                  <Carousel aria-label={t('welcome.recentAssistants')} align="center" className="card-carousel">
                    <CarouselViewport className={scrollFadeClass('x')}>
                      <CarouselContent>
                        {cards.map(card => <CarouselItem key={card.key}>{card}</CarouselItem>)}
                      </CarouselContent>
                    </CarouselViewport>
                    <CarouselIndicatorGroup aria-label={t('welcome.recentAssistants')}>
                      {recentAssistants.map((assistant, index) => <CarouselIndicator key={assistant.id} page={index + 1} aria-label={assistant.name} />)}
                    </CarouselIndicatorGroup>
                  </Carousel>
                ) : (
                  <CardGrid cardRows={3} columns={recentAssistants.length}>{cards}</CardGrid>
                )}
              </Stack>
            )}
          </Stack>
        </Stack>
      </CenteredColumn>
    </Stack>
  );
}
