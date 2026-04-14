import { Dialog } from '../common/Dialog';
import type { ChatFileDto, CreateChatFileDto } from '../../types/chatModels';
import type { ChatFile } from '../../types/fileModels';
import ChatFilePreviewContent from './ChatFilePreviewContent';
import './FilePreviewModal.css';

interface FilePreviewModalProps {
  file: ChatFile | ChatFileDto | CreateChatFileDto | null;
  onClose: () => void;
}

const FilePreviewModal = ({ file, onClose }: FilePreviewModalProps) => {
  if (!file) return null;

  const title = file.sourceFilename || 'Unknown file';

  return (
    <Dialog
      isOpen={!!file}
      onClose={onClose}
      title={title}
      size="xl"
    >
      <ChatFilePreviewContent file={file as ChatFile} />
    </Dialog>
  );
};

export default FilePreviewModal;

