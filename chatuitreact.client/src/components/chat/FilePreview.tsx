import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatFileDto, CreateChatFileDto } from '../../types/chatModels';
import { getFileIcon } from '../../utils/fileUtils';
import FilePreviewModal from './FilePreviewModal';
import './FilePreview.css';

interface FilePreviewProps {
  file: ChatFileDto | CreateChatFileDto;
  onRemove?: () => void;
  showRemoveButton?: boolean;
}

const FilePreview = ({ file, onRemove, showRemoveButton = false }: FilePreviewProps) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<ChatFileDto | CreateChatFileDto | null>(null);

  const handleFileClick = () => {
    setSelectedFile(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  const filename = file.filename || t('files.unknownFile');
  const isImage = file.type === 'Image';

  return (
    <>
      <div 
        className={`file-thumbnail ${isImage ? 'image' : 'text'} clickable`}
        onClick={handleFileClick}
      >
        {showRemoveButton && (
          <button 
            className="remove-btn" 
            onClick={handleRemove}
            title={t('files.removeFile')}
          >
            ×
          </button>
        )}
        
        {isImage ? (
          <img 
            src={file.content.startsWith('data:') 
              ? file.content 
              : `data:image/jpeg;base64,${file.content}`
            }
            alt={filename} 
            className="file-image"
          />
        ) : (
          <div className="file-icon">
            <div className="file-emoji">{getFileIcon(filename)}</div>
            <div className="file-name">{filename}</div>
            <div className="file-info">{t('files.types.text')}</div>
          </div>
        )}
      </div>
      
      <FilePreviewModal 
        file={selectedFile} 
        onClose={() => setSelectedFile(null)} 
      />
    </>
  );
};

export default FilePreview;
