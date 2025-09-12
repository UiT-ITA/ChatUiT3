import React from 'react';
import { useTranslation } from 'react-i18next';
import { MdContentCopy } from 'react-icons/md';
import type { PrivateAssistantDto } from '../../types/assistantModels';
import './ShareModal.css';

interface ShareModalProps {
  isOpen: boolean;
  assistant: PrivateAssistantDto | null;
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
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">{t('assistants.actions.shareAssistant')}</h2>
        </div>
        
        <div className="modal-body">
          <p>{t('assistants.shareDescription', { name: assistant.name })}</p>
          
          <div className="share-option">
            <label>{t('assistants.shareLink')}:</label>
            <div className="share-link-container">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="form-input"
              />
              <button
                onClick={() => onCopyLink(assistant.id)}
                className="button primary"
                title={t('assistants.actions.copyLink')}
              >
                <MdContentCopy size={16} />
              </button>
            </div>
          </div>

          <div className="share-option">
            <label>{t('assistants.assistantId')}:</label>
            <div className="share-link-container">
              <input
                type="text"
                value={assistant.id}
                readOnly
                className="form-input"
              />
              <button
                onClick={() => onCopyGuid(assistant.id)}
                className="button primary"
                title={t('assistants.actions.copyId')}
              >
                <MdContentCopy size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="button secondary"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
