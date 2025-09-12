import { useTranslation } from 'react-i18next';
import type { ChatFileDto, CreateChatFileDto } from '../../types/chatModels';
import { Dialog } from '../common/Dialog';
import './FilePreviewModal.css';

interface FilePreviewModalProps {
  file: ChatFileDto | CreateChatFileDto | null;
  onClose: () => void;
}

const FilePreviewModal = ({ file, onClose }: FilePreviewModalProps) => {
  const { t } = useTranslation();

  if (!file) return null;

  const filename = file.filename || t('files.unknownFile');
  
  const renderContent = () => {
    if (file.type === 'Image') {
      return (
        <img 
          src={file.content.startsWith('data:') 
            ? file.content 
            : `data:image/jpeg;base64,${file.content}`
          } 
          alt={filename}
          className="file-preview-image"
        />
      );
    } else if (file.type === 'Text') {
      return (
        <pre className="file-preview-text">{file.content}</pre>
      );
    }
    return <div className="file-preview-unsupported">{t('files.typeNotSupported')}</div>;
  };

  return (
    <Dialog
      isOpen={!!file}
      onClose={onClose}
      title={filename}
      size="xl"
    >
      <div className="file-preview-content">
        {renderContent()}
      </div>
    </Dialog>
  );
};

export default FilePreviewModal;
