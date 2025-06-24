import { useState } from 'react';
import { ChatFile, ChatFileImage, ContentType } from '../../types/chatModels';
import { getFileIcon, formatFileSize } from '../../utils/fileUtils';
import FilePreviewModal from './FilePreviewModal';
import './FilePreview.css';

interface FilePreviewProps {
  files: (File | ChatFile)[];
  readonly?: boolean;
  onRemove?: (index: number) => void;
}

const FilePreview = ({ files, readonly = false, onRemove }: FilePreviewProps) => {
  const [selectedFile, setSelectedFile] = useState<File | ChatFile | null>(null);

  if (files.length === 0) return null;

  const handleFileClick = (file: File | ChatFile) => {
    setSelectedFile(file);
  };

  const renderFilePreview = (file: File | ChatFile, index: number) => {
    const isFile = file instanceof File;
    const filename = isFile ? file.name : file.filename || '';
    const isImage = isFile 
      ? file.type.startsWith('image/') 
      : (file as ChatFile).type === ContentType.Image;

    const getImageSrc = () => {
      if (isFile) {
        return URL.createObjectURL(file as File);
      } else {
        const imageFile = file as ChatFileImage;
        return `data:image/jpeg;base64,${imageFile.content}`;
      }
    };

    return (
      <div 
        key={index} 
        className={`file-thumbnail ${isImage ? 'image' : 'text'} clickable`}
        onClick={() => handleFileClick(file)}
      >
        {isImage ? (
          <img 
            src={getImageSrc()}
            alt={filename} 
            className="file-image"
          />
        ) : (
          <div className="file-icon">
            <div className="file-emoji">{getFileIcon(filename)}</div>
            <div className="file-name">{filename}</div>
            <div className="file-info">
              {isFile ? formatFileSize((file as File).size) : 'Text file'}
            </div>
          </div>
        )}
        {!readonly && onRemove && (
          <button 
            type="button" 
            className="remove-btn" 
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            aria-label={`Remove ${filename}`}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="file-preview-container">
        {files.map(renderFilePreview)}
      </div>
      <FilePreviewModal 
        file={selectedFile} 
        onClose={() => setSelectedFile(null)} 
      />
    </>
  );
};

export default FilePreview;
