import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Dialog } from '../common/Dialog';
import Button from '../common/Button';
import EmptyNote from '../common/EmptyNote';
import { FilePreview, FilePreviewDocument, FilePreviewImage, FilePreviewText } from '../common/FilePreview';
import RichText, { RichTextLink } from '../common/RichText';
import type { FilePreviewKind } from '../../types/fileModels';
import { fetchOriginal, fileErrorText, saveBlob } from '../../services/fileService';
import { getFileExtension } from '../../utils/fileUtils';
import { ErrorCode } from '../../errors/errorCodes';

// Switched off in stage 1: nothing renders this dialog. The preview that is in use is FilePreviewModal.

/** A file to preview: a file on this device, or a stored file by the endpoint of its original. */
export interface PreviewedFile {
  name: string;
  kind: FilePreviewKind;
  source: File | string;
}

type Loaded = { blob: Blob; url: string; text?: string };

const TEXT_EXTENSIONS = ['txt', 'csv', 'json', 'md', 'markdown'];

/**
 * The name a stored file is saved under. A file stored before originals were kept is served as
 * its text or its image, and gets the matching extension added.
 */
function downloadName(name: string, blob: Blob): string {
  const extension = getFileExtension(name);
  if (blob.type.startsWith('text/plain') && !TEXT_EXTENSIONS.includes(extension)) return `${name}.txt`;
  if (blob.type === 'image/jpeg' && extension !== 'jpg' && extension !== 'jpeg') return `${name}.jpg`;
  if (blob.type === 'image/png' && extension !== 'png') return `${name}.png`;
  return name;
}

/**
 * A dialog with a file's original. PDF, image and text files are shown. Other files can only be
 * downloaded, and a file without an original says so. Renders nothing without a file.
 */
const OriginalFilePreviewModal = ({ file, onClose }: { file: PreviewedFile | null; onClose: () => void }) =>
  file ? <FilePreviewDialog key={typeof file.source === 'string' ? file.source : file.name} file={file} onClose={onClose} /> : null;

const FilePreviewDialog = ({ file, onClose }: { file: PreviewedFile; onClose: () => void }) => {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { source, kind } = file;

  useEffect(() => {
    if (kind === 'unavailable') return;

    let cancelled = false;
    let url: string | undefined;
    void (async () => {
      try {
        const blob = typeof source === 'string' ? await fetchOriginal(source) : source;
        const text = kind === 'text' || kind === 'markdown' ? await blob.text() : undefined;
        if (cancelled) return;
        url = URL.createObjectURL(kind === 'pdf' ? new Blob([blob], { type: 'application/pdf' }) : blob);
        setLoaded({ blob, url, text });
      } catch (loadError) {
        console.error('Failed to load file:', loadError);
        if (!cancelled) setError(fileErrorText(loadError, ErrorCode.FileLoadFailed, t('files.loadFailed')));
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, kind, t]);

  const body = () => {
    if (file.kind === 'unavailable') return <EmptyNote>{t('files.previewNotAvailable')}</EmptyNote>;
    if (error) return <EmptyNote>{error}</EmptyNote>;
    if (!loaded) return <EmptyNote>{t('common.loading')}</EmptyNote>;

    switch (file.kind) {
      case 'image':
        return <FilePreviewImage src={loaded.url} alt={file.name} />;
      case 'pdf':
        return <FilePreviewDocument src={loaded.url} title={file.name} />;
      case 'markdown':
        return (
          <RichText framed>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{ a: ({ href, children }) => <RichTextLink href={href}>{children}</RichTextLink> }}
            >
              {loaded.text ?? ''}
            </ReactMarkdown>
          </RichText>
        );
      case 'text':
        return <FilePreviewText>{loaded.text}</FilePreviewText>;
      default:
        return <EmptyNote>{t('files.downloadOnly')}</EmptyNote>;
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={file.name || t('files.unknownFile')}
      size="xl"
      footer={file.kind !== 'unavailable' && (
        <Button variant="secondary" disabled={!loaded} onClick={() => loaded && saveBlob(loaded.blob, typeof file.source === 'string' ? downloadName(file.name, loaded.blob) : file.name)}>
          {t('files.download')}
        </Button>
      )}
    >
      <FilePreview>{body()}</FilePreview>
    </Dialog>
  );
};

export default OriginalFilePreviewModal;
