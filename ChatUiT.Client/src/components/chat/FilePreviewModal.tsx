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
import { ErrorCode } from '../../errors/errorCodes';

/** A stored file to preview, by the endpoint of its original. */
export interface PreviewedFile {
  name: string;
  kind: FilePreviewKind;
  source: string;
}

type Loaded = { blob: Blob; url: string; text?: string };

/** A dialog with a file's original: a PDF, an image, or text. Renders nothing without a file. */
const FilePreviewModal = ({ file, onClose }: { file: PreviewedFile | null; onClose: () => void }) =>
  file ? <FilePreviewDialog key={file.source} file={file} onClose={onClose} /> : null;

const FilePreviewDialog = ({ file, onClose }: { file: PreviewedFile; onClose: () => void }) => {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { source, kind } = file;

  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    void (async () => {
      try {
        const blob = await fetchOriginal(source);
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
      default:
        return <FilePreviewText>{loaded.text}</FilePreviewText>;
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={file.name || t('files.unknownFile')}
      size="xl"
      footer={(
        <Button variant="secondary" disabled={!loaded} onClick={() => loaded && saveBlob(loaded.blob, file.name)}>
          {t('files.download')}
        </Button>
      )}
    >
      <FilePreview>{body()}</FilePreview>
    </Dialog>
  );
};

export default FilePreviewModal;
