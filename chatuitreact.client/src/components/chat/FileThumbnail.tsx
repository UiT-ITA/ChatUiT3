import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatFileDto, CreateChatFileDto } from '../../types/chatModels';
import { Icon } from '../common/Icon';
import { getFileExtension } from '../../utils/fileUtils';
import type { ProcessedFile, ImageChunk } from '../../types/importModels';
import FilePreviewModal from './FilePreviewModal';
import './FileThumbnail.css';

interface FileThumbnailProps {
  file: ProcessedFile | ChatFileDto | CreateChatFileDto;
  onRemove?: () => void;
  showRemoveButton?: boolean;
}

const FileThumbnail = ({ file, onRemove, showRemoveButton = false }: FileThumbnailProps) => {
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
  const filename = isProcessedFile ? (file as ProcessedFile).sourceFilename : ((file as ChatFileDto | CreateChatFileDto).filename ?? 'Unknown file');
  const extension = getFileExtension(filename).toUpperCase() || 'FILE';

  const truncateFilename = (name: string, maxLength: number = 20) => {
    const nameWithoutExt = name.lastIndexOf('.') !== -1 ? name.substring(0, name.lastIndexOf('.')) : name;
    if (nameWithoutExt.length <= maxLength) return nameWithoutExt;
    return `${nameWithoutExt.substring(0, maxLength)}...`;
  };

  let isImage = false;
  let imageSource = '';

  if (isProcessedFile) {
      const processed = file as ProcessedFile;
      // Only treat as image thumbnail if it's EXACTLY one chunk and it's an image.
      // This prevents PDFs with embedded images from showing up as image thumbnails.
      isImage = processed.chunks.length === 1 && processed.chunks[0].type === 'image';
      if (isImage) {
          imageSource = `data:image/jpeg;base64,${(processed.chunks[0] as ImageChunk).base64}`;
      }
  } else {
      const chatFile = file as ChatFileDto | CreateChatFileDto;
      isImage = chatFile.type === 'Image';
      if (isImage) {
        imageSource = chatFile.content.startsWith('data:') ? chatFile.content : `data:image/jpeg;base64,${chatFile.content}`;
      }
  }

  return (
    <>
      <div
        className={`file-thumbnail clickable ${isImage ? 'image-thumbnail' : 'document-thumbnail'}`}
        onClick={handleFileClick}
      >
        {showRemoveButton && (
          <button 
            className="remove-btn" 
            onClick={handleRemove}
            title={t('files.removeFile')}
          >
            <Icon name="close" size={0.8} />
          </button>
        )}

        {isImage ? (
          <img
            src={imageSource}
            alt={filename}
            className="file-thumbnail-image"
          />
        ) : (
          <div className="file-thumbnail-content">
            <div className="file-thumbnail-icon-wrapper">
              <Icon name="file" className="file-thumbnail-icon" />
            </div>
            <div className="file-thumbnail-info">
              <div className="file-thumbnail-name" title={filename}>
                {truncateFilename(filename)}
              </div>
              <div className="file-thumbnail-extension">
                {extension}
              </div>
            </div>
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

export default FileThumbnail;
