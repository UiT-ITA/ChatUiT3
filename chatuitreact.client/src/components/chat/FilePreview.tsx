import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatFileDto, CreateChatFileDto } from '../../types/chatModels';
import { getFileIcon } from '../../utils/fileUtils';
import type { ProcessedFile } from '../../types/importModels';
import FilePreviewModal from './FilePreviewModal';
import ProcessedFilePreviewContent from './ProcessedFilePreviewContent';
import './FilePreview.css';

interface FilePreviewProps {
  file: ProcessedFile | ChatFileDto | CreateChatFileDto;
  onRemove?: () => void;
  showRemoveButton?: boolean;
}

const FilePreview = ({ file, onRemove, showRemoveButton = false }: FilePreviewProps) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<ProcessedFile | ChatFileDto | CreateChatFileDto | null>(null);

  const handleFileClick = () => {
    setSelectedFile(file);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  const isProcessedFile = 'sourceFilename' in file;
  const filename = isProcessedFile ? file.sourceFilename : (file.filename ?? 'Unknown file');

  return (
    <>
      <div
        className="file-thumbnail clickable"
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

        <div className="file-thumbnail-header">
          <div className="file-emoji">{getFileIcon(filename)}</div>
          <div className="file-name">{filename}</div>
        </div>

        <div className="file-thumbnail-body">
          {isProcessedFile ? (
            <ProcessedFilePreviewContent file={file} compact={true} />
          ) : file.type === 'Image' ? (
            <img
              src={file.content.startsWith('data:') ? file.content : `data:image/jpeg;base64,${file.content}`}
              alt={filename}
              className="file-preview-image"
            />
          ) : (
            <pre className="file-preview-text">{file.content}</pre>
          )}
        </div>
      </div>
      
      <FilePreviewModal 
        file={selectedFile} 
        onClose={() => setSelectedFile(null)} 
      />
    </>
  );
};

export default FilePreview;
