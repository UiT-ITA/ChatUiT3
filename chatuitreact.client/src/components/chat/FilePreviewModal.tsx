import { useEffect } from 'react';
import { ChatFile, ChatFileText, ChatFileImage, ContentType } from '../../types/chatModels';
import './FilePreviewModal.css';

interface FilePreviewModalProps {
  file: File | ChatFile | null;
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

  const isFileObject = file instanceof File;
  const filename = isFileObject ? file.name : file.filename || 'Unknown file';
  
  const renderContent = () => {
    if (isFileObject) {
      const fileObj = file as File;
      if (fileObj.type.startsWith('image/')) {
        return (
          <img 
            src={URL.createObjectURL(fileObj)} 
            alt={filename}
            className="modal-image"
          />
        );
      } else {
        return <div className="modal-text">File preview not available</div>;
      }
    } else {
      const chatFile = file as ChatFile;
      if (chatFile.type === ContentType.Image) {
        const imageFile = chatFile as ChatFileImage;
        return (
          <img 
            src={`data:image/jpeg;base64,${imageFile.content}`} 
            alt={filename}
            className="modal-image"
          />
        );
      } else if (chatFile.type === ContentType.Text) {
        const textFile = chatFile as ChatFileText;
        return (
          <pre className="modal-text">{textFile.content}</pre>
        );
      }
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
