import { useSignals } from '@preact/signals-react/runtime';
import { useTranslation } from 'react-i18next';
import Box from '../common/Box';
import { Icon } from '../common/Icon';
import Stack from '../common/Stack';
import Text from '../common/Text';
import { getChat, getSelectableAssistants } from '../../services/chatService';
import { getContextUsage } from '../../services/contextUsageService';
import ContextUsageDetails from './ContextUsageDetails';

/** The side panel of an open chat: its files, context usage, assistant and dates. */
function ConversationPanel({ chatId }: { chatId: string }) {
  useSignals();
  const { t, i18n } = useTranslation();

  const chat = getChat(chatId).value;
  const assistants = getSelectableAssistants().value || [];
  const assistant = chat ? assistants.find((a) => a.id === chat.assistantId) : undefined;

  const files = chat?.messages.flatMap((message) => message.files || []) || [];
  const usage = getContextUsage(chatId).value;

  const formatDate = (value: string) => new Date(value).toLocaleDateString(i18n.language, { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <Box as="aside" width="xs" grow={false} shrink={false} pt="xl" pb="xl" px="lg" overflow="y-auto" border borderSide="left">
      <Text as="div" variant="overline" pb="sm" mb="md" border="accent-2" borderWidth="lg" borderSide="bottom">{t('chat.panel.title')}</Text>

      <Text as="div" variant="overline" mt="xl" pb="sm" mb="md" border borderSide="bottom">{t('chat.panel.files')}</Text>
      {files.length > 0 ? (
        <Stack gap="sm">
          {files.map((file) => (
            <Stack key={file.id} direction="row" align="center" gap="sm">
              <Icon name="file" size="sm" color="accent" />
              <Text variant="caption" tone="secondary" truncate>{file.sourceFilename}</Text>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text as="div" variant="caption" tone="muted">{t('chat.panel.noFiles')}</Text>
      )}

      <Text as="div" variant="overline" mt="xl" pb="sm" mb="md" border borderSide="bottom">{t('chat.panel.context')}</Text>
      {usage.available ? (
        <ContextUsageDetails usage={usage} />
      ) : (
        <Text as="div" variant="caption" tone="muted">{t('chat.panel.contextUnavailable')}</Text>
      )}

      <Text as="div" variant="hint" tone="muted" leading="base" mt="xl">
        {assistant && <>{t('chat.panel.assistant')}: {assistant.name}<br /></>}
        {chat?.createdAt && <>{t('chat.panel.created')}: {formatDate(chat.createdAt)}<br /></>}
        {chat?.updatedAt && <>{t('chat.panel.updated')}: {formatDate(chat.updatedAt)}</>}
      </Text>
    </Box>
  );
}

export default ConversationPanel;
