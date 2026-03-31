import { Dialog } from '../common/Dialog';
import type { ChatFileDto, CreateChatFileDto } from '../../types/chatModels';
import type { ProcessedFile } from '../../types/importModels';
import ProcessedFilePreviewContent from './ProcessedFilePreviewContent';
import './FilePreviewModal.css';

interface FilePreviewModalProps {
  file: ProcessedFile | ChatFileDto | CreateChatFileDto | null;
  onClose: () => void;
}

const FilePreviewModal = ({ file, onClose }: FilePreviewModalProps) => {
  if (!file) return null;

  const isProcessedFile = 'sourceFilename' in file;
  const title = isProcessedFile ? file.sourceFilename : (file.filename ?? 'Unknown file');

  return (
    <Dialog
      isOpen={!!file}
      onClose={onClose}
      title={title}
      size="xl"
    >
      {isProcessedFile ? (
        <ProcessedFilePreviewContent file={file} />
      ) : (
        <div className="file-preview-content">
          {file.type === 'Image' ? (
            <img
              src={file.content.startsWith('data:') ? file.content : `data:image/jpeg;base64,${file.content}`}
              alt={title}
              className="file-preview-image"
            />
          ) : (
            <pre className="file-preview-text">{file.content}</pre>
          )}
        </div>
      )}
    </Dialog>
  );
};

export default FilePreviewModal;
