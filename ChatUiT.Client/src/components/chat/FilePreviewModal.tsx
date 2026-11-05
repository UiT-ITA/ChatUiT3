import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Dialog } from '../common/Dialog';
import { FilePreview, FilePreviewImage, FilePreviewText } from '../common/FilePreview';
import RichText, { RichTextLink } from '../common/RichText';
import type { ChatFileDto, CreateChatFileDto } from '../../types/chatModels';
import type { ChatFile } from '../../types/fileModels';
import { toJpegDataUrl } from '../../import/processingShared';

/** A dialog with a file's content: its images, markdown and text. Renders nothing without a file. */
const FilePreviewModal = ({ file, onClose }: { file: ChatFile | ChatFileDto | CreateChatFileDto | null; onClose: () => void }) => {
  const { t } = useTranslation();
  if (!file) return null;

  return (
    <Dialog isOpen onClose={onClose} title={file.sourceFilename || t('files.unknownFile')} size="xl">
      <FilePreview>
        {(file as ChatFile).chunks.map((chunk, index) => chunk.type === 'image' ? (
          <FilePreviewImage key={index} src={toJpegDataUrl(chunk.base64)} alt={file.sourceFilename} />
        ) : chunk.format === 'markdown' ? (
          <RichText key={index} framed>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{ a: ({ href, children }) => <RichTextLink href={href}>{children}</RichTextLink> }}
            >
              {chunk.text}
            </ReactMarkdown>
          </RichText>
        ) : (
          <FilePreviewText key={index}>{chunk.text}</FilePreviewText>
        ))}
      </FilePreview>
    </Dialog>
  );
};

export default FilePreviewModal;
