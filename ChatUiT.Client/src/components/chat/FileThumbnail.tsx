import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatFileDto, CreateChatFileDto } from '../../types/chatModels';
import { Icon } from '../common/Icon';
import { getFileExtension } from '../../utils/fileUtils';
import type { ChatFile } from '../../types/fileModels';
import { fetchChatFile } from '../../services/chatService';
import FilePreviewModal from './FilePreviewModal';
import './FileThumbnail.css';

type AnyChatFile = ChatFile | ChatFileDto | CreateChatFileDto;

interface FileThumbnailProps {
  file: AnyChatFile;
  /**
   * The chat this file belongs to. Required to fetch persisted content — it must
   * come from the owning chat, never from "whichever chat is open", since chats
   * stay mounted while hidden. Omitted for composer files, which always carry
   * their content and so never fetch.
   */
  chatId?: string;
  onRemove?: () => void;
  showRemoveButton?: boolean;
}

function hasFullContent(file: AnyChatFile): boolean {
  return file.chunks.every((chunk) =>
    chunk.type === 'image' ? chunk.base64 != null : chunk.text != null
  );
}

const FileThumbnail = ({ file, chatId, onRemove, showRemoveButton = false }: FileThumbnailProps) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<AnyChatFile | null>(null);
  const [loadedFile, setLoadedFile] = useState<ChatFileDto | null>(null);

  // Persisted files arrive with metadata only; their content is fetched on demand.
  const storedFileId = 'id' in file ? file.id : undefined;
  const effectiveFile = loadedFile ?? file;
  const needsFetch = !!storedFileId && !hasFullContent(effectiveFile);

  const ensureContent = async (): Promise<AnyChatFile> => {
    if (!needsFetch || !storedFileId) {
      return effectiveFile;
    }

    if (!chatId) {
      return effectiveFile;
    }

    try {
      const fetched = await fetchChatFile(chatId, storedFileId);
      setLoadedFile(fetched);
      return fetched;
    } catch (error) {
      console.error(`Failed to load file ${storedFileId}:`, error);
      return effectiveFile;
    }
  };

  const handleFileClick = async () => {
    setSelectedFile(await ensureContent());
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  const filename = effectiveFile.sourceFilename ?? 'Unknown file';
  const extension = getFileExtension(filename).toUpperCase() || 'FILE';

  const truncateFilename = (name: string, maxLength: number = 20) => {
    const nameWithoutExt = name.lastIndexOf('.') !== -1 ? name.substring(0, name.lastIndexOf('.')) : name;
    if (nameWithoutExt.length <= maxLength) return nameWithoutExt;
    return `${nameWithoutExt.substring(0, maxLength)}...`;
  };

  // Only treat as image thumbnail if it's EXACTLY one chunk and it's an image.
  // This prevents PDFs with embedded images from showing up as image thumbnails.
  const singleChunk = effectiveFile.chunks.length === 1 ? effectiveFile.chunks[0] : undefined;
  const isImage = singleChunk?.type === 'image';
  const imageBase64 = isImage ? singleChunk.base64 : undefined;
  const imageSource = imageBase64
    ? (imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`)
    : '';

  useEffect(() => {
    if (!isImage || imageBase64 || !needsFetch || !chatId || !storedFileId) return;

    let cancelled = false;
    fetchChatFile(chatId, storedFileId)
      .then((fetched) => {
        if (!cancelled) setLoadedFile(fetched);
      })
      .catch((error) => {
        console.error(`Failed to load file ${storedFileId}:`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [isImage, imageBase64, needsFetch, chatId, storedFileId]);

  return (
    <>
      <div
        className={`file-thumbnail clickable ${isImage && imageSource ? 'image-thumbnail' : 'document-thumbnail'}`}
        onClick={() => void handleFileClick()}
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

        {isImage && imageSource ? (
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
              <div className="file-thumbnail-name t-caption-strong" title={filename}>
                {truncateFilename(filename)}
              </div>
              <div className="file-thumbnail-extension t-meta">
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
