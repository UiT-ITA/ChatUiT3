import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FullAssistantDto } from '../../types/assistantModels';
import { Dialog } from '../common/Dialog';
import Field from '../common/Field';
import TextInput from '../common/TextInput';
import IconButton from '../common/IconButton';
import Stack from '../common/Stack';
import InputRow from '../common/InputRow';
import Text from '../common/Text';

interface ShareModalProps {
  /** The assistant to share, or null when the dialog is closed. */
  assistant: FullAssistantDto | null;
  onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ assistant, onClose }) => {
  const { t } = useTranslation();
  if (!assistant) return null;

  const fields = [
    { label: t('assistants.shareLink'), value: `${window.location.origin}/assistants?add=${assistant.id}`, copyLabel: t('assistants.actions.copyLink') },
    { label: t('assistants.assistantId'), value: assistant.id, copyLabel: t('assistants.actions.copyId') },
  ];

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={t('assistants.actions.shareAssistant')}
      size="medium"
    >
      <Stack gap="xl" mobileGap="lg">
        <Text as="p" variant="body" tone="default" leading="base">
          {t('assistants.shareDescription', { name: assistant.name })}
        </Text>
        {fields.map(({ label, value, copyLabel }) => (
          <Field key={label} label={`${label}:`}>
            <InputRow>
              <TextInput
                monospace
                value={value}
                readOnly
                grow
                onFocus={(e) => e.currentTarget.select()}
              />
              <IconButton
                icon="copy"
                label={copyLabel}
                variant="primary"
                size="large"
                onClick={() => navigator.clipboard.writeText(value)}
              />
            </InputRow>
          </Field>
        ))}
      </Stack>
    </Dialog>
  );
};

export default ShareModal;
