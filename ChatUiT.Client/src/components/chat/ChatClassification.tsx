import { useTranslation } from 'react-i18next';
import { useSignals } from '@preact/signals-react/runtime';
import ClassificationBadge from '../classification/ClassificationBadge';
import IconButton from '../common/IconButton';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@ui-sdk/react/popover';
import { floatingPanelClass } from '../common/floatingPanel';
import { spacePx } from '../common/layout';
import { Switch, SwitchThumb } from '@ui-sdk/react/switch';
import { getCurrentAssistantId, getCurrentChatId, getRedEnabled, toggleRed } from '../../services/chatService';
import { getAssistant } from '../../services/assistantService';
import { chatClassification, DATA_CLASSIFICATIONS } from '../../types/modelModels';
import Box from '../common/Box';
import Stack from '../common/Stack';
import Text from '../common/Text';
import './ClassificationLevels.css';

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
    return <ClassificationBadge classification={classification} mx="xs" shrink={false} />;
  }

  return (
    <Popover openOnHover>
      <PopoverTrigger
        render={(
          <IconButton
            icon={<ClassificationBadge classification={classification} showTitle={false} />}
            label={t('classification.title', { level: t(`classification.${classification}`) })}
            size="small"
            tooltip={false}
          />
        )}
      />
      <PopoverContent side="top" align="start" sideOffset={spacePx('sm')} className={floatingPanelClass('large')}>
        <PopoverTitle render={<div />} className="popover__title t-overline">{t('classification.heading')}</PopoverTitle>
        <div className="popover__body">
          <Stack as="ul" gap="xs">
            {DATA_CLASSIFICATIONS.map(level => (
              <li key={level} className="classification-levels__level t-hint" aria-current={level === classification ? 'true' : undefined}>
                <ClassificationBadge classification={level} showTitle={false} strong={level === classification} />
                <span>{t(`classification.descriptions.${level}`)}</span>
              </li>
            ))}
          </Stack>
          <Box pt="md" border borderSide="top">
            <label className="switch-label t-ui">
              <span>{t('chat.redToggle.label')}</span>
              <Switch className="switch--critical" checked={redEnabled} onCheckedChange={() => { void toggleRed(); }} disabled={redLocked}>
                <SwitchThumb />
              </Switch>
            </label>
            <Text as="div" variant="hint" tone="muted" mt="sm">{t(redEnabled ? 'chat.redToggle.enabled' : 'chat.redToggle.enable')}</Text>
          </Box>
        </div>
      </PopoverContent>
    </Popover>
  );
}
