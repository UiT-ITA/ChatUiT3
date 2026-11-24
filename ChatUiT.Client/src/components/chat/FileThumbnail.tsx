import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatFileDto } from '../../types/chatModels';
import FileChip from '../common/FileChip';
import IconButton from '../common/IconButton';
import { getFileExtension, isImageImportFile, toJpegDataUrl } from '../../utils/fileUtils';
import { fetchChatFile } from '../../services/chatService';
import FilePreviewModal from './FilePreviewModal';

interface FileThumbnailProps {
  /** A stored file, or a file on this device that is not sent yet. */
  file: ChatFileDto | File;
  /** The chat the stored file belongs to, for fetching its content. */
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

const hasFullContent = (file: ChatFileDto) => file.chunks.every((chunk) => chunk.type === 'image' ? chunk.base64 != null : chunk.text != null);

/** The object URL of an image on this device, or '' for any other file. */
function useLocalImage(file: ChatFileDto | File): string {
  const [source, setSource] = useState('');

  useEffect(() => {
    if (!(file instanceof File) || !isImageImportFile(file)) return;
    const url = URL.createObjectURL(file);
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setSource(url);
    });
    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return source;
}

/**
 * A chip for an attached file. An image shows as a thumbnail. A click on a stored file opens its
 * preview. A file that is not sent yet has no preview.
 */
const FileThumbnail = ({ file, chatId, onRemove }: FileThumbnailProps) => {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState<ChatFileDto | null>(null);
  const [loadedFile, setLoadedFile] = useState<ChatFileDto | null>(null);
  const localImage = useLocalImage(file);

  // A stored file without its content fetches the content on demand
  const storedFile = file instanceof File ? undefined : (loadedFile ?? file);
  const needsFetch = storedFile !== undefined && !hasFullContent(storedFile);

  // Opens the preview, with the content of the stored file fetched first
  const handleFileClick = async () => {
    if (!storedFile) return;
    const fetched = needsFetch && chatId ? await loadStoredFile(chatId, storedFile.id) : undefined;
    if (fetched) setLoadedFile(fetched);
    setSelectedFile(fetched ?? storedFile);
  };

  const filename = (file instanceof File ? file.name : file.sourceFilename) || t('files.unknownFile');
  const extension = getFileExtension(filename).toUpperCase() || 'FILE';
  // The name without its extension
  const baseName = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;

  // An image thumbnail for a stored file of exactly one chunk that is an image
  const singleChunk = storedFile?.chunks.length === 1 ? storedFile.chunks[0] : undefined;
  const isStoredImage = singleChunk?.type === 'image';
  const imageBase64 = isStoredImage ? singleChunk.base64 : undefined;
  const imageSource = imageBase64 ? toJpegDataUrl(imageBase64) : localImage;
  const storedFileId = storedFile?.id;

  // An image thumbnail of a stored file fetches its content to show it
  useEffect(() => {
    if (!isStoredImage || imageBase64 || !needsFetch || !chatId || !storedFileId) return;
    let cancelled = false;
    void loadStoredFile(chatId, storedFileId).then((fetched) => {
      if (fetched && !cancelled) setLoadedFile(fetched);
    });
    return () => {
      cancelled = true;
    };
  }, [isStoredImage, imageBase64, needsFetch, chatId, storedFileId]);

  return (
    <>
      <FileChip
        image={imageSource ? { src: imageSource, alt: filename } : undefined}
        name={baseName}
        title={filename}
        extension={extension}
        onClick={storedFile ? () => void handleFileClick() : undefined}
        removeAction={onRemove && (
          <IconButton
            icon="close"
            label={t('files.removeFile')}
            variant={imageSource ? 'subtle' : 'ghost'}
            shape={imageSource ? 'round' : 'square'}
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
