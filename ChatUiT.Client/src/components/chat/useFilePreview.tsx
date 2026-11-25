import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadOriginal, fileContentEndpoint, fileErrorText, previewKindOf } from '../../services/fileService';
import { addNotification } from '../../services/notificationService';
import { ErrorCode } from '../../errors/errorCodes';
import FilePreviewModal, { type PreviewedFile } from './FilePreviewModal';

/**
 * Opens stored files: a PDF, image or text file in the preview dialog, any other file as a
 * download. `open` gives no handler for a file without a preview. Render `dialog`.
 */
export function useFilePreview() {
  const { t } = useTranslation();
  const [previewed, setPreviewed] = useState<PreviewedFile | null>(null);

  const open = (name: string, filesEndpoint: string, fileId: string): (() => void) | undefined => {
    const kind = previewKindOf(name);
    const source = fileContentEndpoint(filesEndpoint, fileId);
    if (kind === 'none') return undefined;
    if (kind === 'download') {
      return () => {
        downloadOriginal(source, name).catch((error) => {
          console.error('Failed to download file:', error);
          addNotification({ level: 'Warning', message: `${name}: ${fileErrorText(error, ErrorCode.FileLoadFailed, t('files.loadFailed'))}` });
        });
      };
    }
    return () => setPreviewed({ name, kind, source });
  };

  const dialog = <FilePreviewModal file={previewed} onClose={() => setPreviewed(null)} />;

  return { open, dialog };
}
