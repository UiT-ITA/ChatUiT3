import { useEffect } from 'react';
import type { ChatFileDto, CreateChatFileDto } from '../../types/chatModels';
import './FilePreviewModal.css';

interface FilePreviewModalProps {
  file: ChatFileDto | CreateChatFileDto | null;
  onClose: () => void;
}

const FilePreviewModal = ({ file, onClose }: FilePreviewModalProps) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!file) return null;

  const filename = file.filename || 'Unknown file';
  
  const renderContent = () => {
    if (file.type === 'Image') {
      return (
        <img 
          src={file.content.startsWith('data:') 
            ? file.content 
            : `data:image/jpeg;base64,${file.content}`
          } 
          alt={filename}
          className="modal-image"
        />
      );
    } else if (file.type === 'Text') {
      return (
        <pre className="modal-text">{file.content}</pre>
      );
    }
    return <div className="modal-text">File type not supported</div>;
  };

  return (
    <div className="file-modal-overlay" onClick={onClose}>
      <div className="file-modal" onClick={(e) => e.stopPropagation()}>
        <div className="file-modal-header">
          <h3>{filename}</h3>
          <button className="file-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="file-modal-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
