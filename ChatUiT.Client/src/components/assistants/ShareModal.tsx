import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FullAssistantDto } from '../../types/assistantModels';
import { Dialog } from '../common/Dialog';
import Field from '../common/Field';
import TextInput from '../common/TextInput';
import IconButton from '../common/IconButton';
import Stack from '../common/Stack';
import useMediaQuery from '../../hooks/useMediaQuery';
import './ShareModal.css';

interface ShareModalProps {
  isOpen: boolean;
  assistant: FullAssistantDto | null;
  onClose: () => void;
  onCopyLink: (assistantId: string) => void;
  onCopyGuid: (assistantId: string) => void;
}

const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  assistant,
  onClose,
  onCopyLink,
  onCopyGuid
}) => {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  if (!isOpen || !assistant) return null;

  const shareUrl = `${window.location.origin}/assistants?add=${assistant.id}`;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('assistants.actions.shareAssistant')}
      size="medium"
    >
      <div className="share-content">
        <p className="share-description t-body">
          {t('assistants.shareDescription', { name: assistant.name })}
        </p>
        
        <Field label={`${t('assistants.shareLink')}:`}>
          <Stack direction={isMobile ? 'column' : 'row'} gap={isMobile ? 'md' : 'sm'} align={isMobile ? 'stretch' : 'center'}>
            <TextInput
              monospace
              value={shareUrl}
              readOnly
              grow
              onFocus={(e) => e.currentTarget.select()}
            />
            <IconButton
              icon="copy"
              label={t('assistants.actions.copyLink')}
              variant="primary"
              size="large"
              onClick={() => onCopyLink(assistant.id)}
              width={isMobile ? 'full' : undefined}
            />
          </Stack>
        </Field>

        <Field label={`${t('assistants.assistantId')}:`}>
          <Stack direction={isMobile ? 'column' : 'row'} gap={isMobile ? 'md' : 'sm'} align={isMobile ? 'stretch' : 'center'}>
            <TextInput
              monospace
              value={assistant.id}
              readOnly
              grow
              onFocus={(e) => e.currentTarget.select()}
            />
            <IconButton
              icon="copy"
              label={t('assistants.actions.copyId')}
              variant="primary"
              size="large"
              onClick={() => onCopyGuid(assistant.id)}
              width={isMobile ? 'full' : undefined}
            />
          </Stack>
        </Field>
      </div>
    </Dialog>
  );
};

export default ShareModal;
