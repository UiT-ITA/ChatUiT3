import { ChatFile, ChatFileImage, ContentType } from '../../types/chatModels';
import { getFileIcon, formatFileSize } from '../../utils/fileUtils';
import './FilePreview.css';

interface FilePreviewProps {
  files: (File | ChatFile)[];
  readonly?: boolean;
  onRemove?: (index: number) => void;
}

const FilePreview = ({ files, readonly = false, onRemove }: FilePreviewProps) => {
  if (files.length === 0) return null;

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
      <div key={index} className={`file-thumbnail ${isImage ? 'image' : 'text'}`}>
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
            onClick={() => onRemove(index)}
            aria-label={`Remove ${filename}`}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="file-preview-container">
      {files.map(renderFilePreview)}
    </div>
  );
};

export default FilePreview;
