import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatFileDto, CreateChatFileDto } from '../../types/chatModels';
import FileChip from '../common/FileChip';
import IconButton from '../common/IconButton';
import { getFileExtension } from '../../utils/fileUtils';
import type { ChatFile } from '../../types/fileModels';
import { fetchChatFile } from '../../services/chatService';
import FilePreviewModal from './FilePreviewModal';
import { toJpegDataUrl } from '../../import/processingShared';

type AnyChatFile = ChatFile | ChatFileDto | CreateChatFileDto;

interface FileThumbnailProps {
  file: AnyChatFile;
  /** The chat the file belongs to, for fetching a stored file's content. Omitted for files in the composer. */
  chatId?: string;
  // Shows a remove button that calls this
  onRemove?: () => void;
}

/** A stored file with its content, or undefined when it could not be fetched. */
const loadStoredFile = (chatId: string, fileId: string): Promise<ChatFileDto | undefined> =>
  fetchChatFile(chatId, fileId).catch((error) => {
    console.error(`Failed to load file ${fileId}:`, error);
    return undefined;
  });

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
    const fetched = needsFetch && chatId && storedFileId ? await loadStoredFile(chatId, storedFileId) : undefined;
    if (fetched) setLoadedFile(fetched);
    setSelectedFile(fetched ?? effectiveFile);
  };

  const filename = effectiveFile.sourceFilename ?? t('files.unknownFile');
  const extension = getFileExtension(filename).toUpperCase() || 'FILE';
  // The name without its extension
  const baseName = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;

  // An image thumbnail for a file of exactly one chunk that is an image
  const singleChunk = effectiveFile.chunks.length === 1 ? effectiveFile.chunks[0] : undefined;
  const isImage = singleChunk?.type === 'image';
  const imageBase64 = isImage ? singleChunk.base64 : undefined;
  const imageSource = imageBase64 ? toJpegDataUrl(imageBase64) : '';

  // An image thumbnail of a stored file fetches its content to show it
  useEffect(() => {
    if (!isImage || imageBase64 || !needsFetch || !chatId || !storedFileId) return;
    let cancelled = false;
    void loadStoredFile(chatId, storedFileId).then((fetched) => {
      if (fetched && !cancelled) setLoadedFile(fetched);
    });
    return () => {
      cancelled = true;
    };
  }, [isImage, imageBase64, needsFetch, chatId, storedFileId]);

  return (
    <>
      <FileChip
        image={isImage && imageSource ? { src: imageSource, alt: filename } : undefined}
        name={baseName}
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
