import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatFileDto, CreateChatFileDto } from '../../types/chatModels';
import FileChip from '../common/FileChip';
import IconButton from '../common/IconButton';
import { getFileExtension } from '../../utils/fileUtils';
import type { ChatFile } from '../../types/fileModels';
import { fetchChatFile } from '../../services/chatService';
import FilePreviewModal from './FilePreviewModal';

type AnyChatFile = ChatFile | ChatFileDto | CreateChatFileDto;

interface FileThumbnailProps {
  file: AnyChatFile;
  /** The chat the file belongs to, for fetching a stored file's content. Omitted for files in the composer. */
  chatId?: string;
  // Shows a remove button that calls this
  onRemove?: () => void;
}

const hasFullContent = (file: AnyChatFile) => file.chunks.every((chunk) => chunk.type === 'image' ? chunk.base64 != null : chunk.text != null);

const FileThumbnail = ({ file, chatId, onRemove }: FileThumbnailProps) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<AnyChatFile | null>(null);
  const [loadedFile, setLoadedFile] = useState<ChatFileDto | null>(null);

  // A stored file without its content fetches the content on demand
  const storedFileId = 'id' in file ? file.id : undefined;
  const effectiveFile = loadedFile ?? file;
  const needsFetch = !!storedFileId && !hasFullContent(effectiveFile);

  // Opens the preview, with the content of a stored file fetched first
  const handleFileClick = async () => {
    let shown = effectiveFile;
    if (needsFetch && storedFileId && chatId) {
      try {
        const fetched = await fetchChatFile(chatId, storedFileId);
        setLoadedFile(fetched);
        shown = fetched;
      } catch (error) {
        console.error(`Failed to load file ${storedFileId}:`, error);
      }
    }
    setSelectedFile(shown);
  };

  const filename = effectiveFile.sourceFilename ?? t('files.unknownFile');
  const extension = getFileExtension(filename).toUpperCase() || 'FILE';
  // The name without its extension, cut after 20 characters
  const baseName = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;
  const shortName = baseName.length <= 20 ? baseName : `${baseName.substring(0, 20)}...`;

  // An image thumbnail for a file of exactly one chunk that is an image
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
      <FileChip
        image={isImage && imageSource ? { src: imageSource, alt: filename } : undefined}
        name={shortName}
        title={filename}
        extension={extension}
        onClick={() => void handleFileClick()}
        removeAction={onRemove && (
          <IconButton
            icon="close"
            label={t('files.removeFile')}
            variant={isImage && imageSource ? 'subtle' : 'ghost'}
            shape={isImage && imageSource ? 'round' : 'square'}
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          />
        )}
      />

      <FilePreviewModal file={selectedFile} onClose={() => setSelectedFile(null)} />
    </>
  );
};

export default FileThumbnail;
