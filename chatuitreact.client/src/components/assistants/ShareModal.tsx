import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FullAssistantDto } from '../../types/assistantModels';
import { Dialog } from '../common/Dialog';
import { Icon } from '../common/Icon';
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
        
        <div className="share-option">
          <label className="share-label t-label">{t('assistants.shareLink')}:</label>
          <div className="share-link-container">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="share-input t-code"
            />
            <button
              onClick={() => onCopyLink(assistant.id)}
              className="share-copy-button t-ui"
              title={t('assistants.actions.copyLink')}
            >
              <Icon name="copy" size={1} />
            </button>
          </div>
        </div>

        <div className="share-option">
          <label className="share-label t-label">{t('assistants.assistantId')}:</label>
          <div className="share-link-container">
            <input
              type="text"
              value={assistant.id}
              readOnly
              className="share-input t-code"
            />
            <button
              onClick={() => onCopyGuid(assistant.id)}
              className="share-copy-button t-ui"
              title={t('assistants.actions.copyId')}
            >
              <Icon name="copy" size={1} />
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ShareModal;
