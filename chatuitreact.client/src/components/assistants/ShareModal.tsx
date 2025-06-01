import React from 'react';
import { MdContentCopy } from 'react-icons/md';
import { PrivateAssistantDto } from '../../types/dtos';
import './AssistantModals.css';

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
  if (!isOpen || !assistant) return null;

  const shareUrl = `${window.location.origin}/assistants?add=${assistant.id}`;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Share Assistant</h2>
        </div>
        
        <div className="modal-body">
          <p>Share "{assistant.name}" with others:</p>
          
          <div className="share-option">
            <label>Share Link:</label>
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
                title="Copy link"
              >
                <MdContentCopy size={16} />
              </button>
            </div>
          </div>

          <div className="share-option">
            <label>Assistant ID:</label>
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
                title="Copy ID"
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
