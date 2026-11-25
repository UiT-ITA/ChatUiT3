import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Dialog } from '../common/Dialog';
import { FilePreview, FilePreviewImage, FilePreviewText } from '../common/FilePreview';
import RichText, { RichTextLink } from '../common/RichText';
import type { ChatFileChunkDto } from '../../types/chatModels';
import { isMarkdownPreview, toJpegDataUrl } from '../../utils/fileUtils';

/** A file with the content of its parts. */
export interface PreviewedFile {
  sourceFilename: string;
  chunks: ChatFileChunkDto[];
}

/** A dialog with a file's content: its images, and its text as markdown or as text by the file name. Renders nothing without a file. */
const FilePreviewModal = ({ file, onClose }: { file: PreviewedFile | null; onClose: () => void }) => {
  const { t } = useTranslation();
  if (!file) return null;
  const markdown = isMarkdownPreview(file.sourceFilename);

  return (
    <Dialog isOpen onClose={onClose} title={file.sourceFilename || t('files.unknownFile')} size="xl">
      <FilePreview>
        {file.chunks.map((chunk, index) => chunk.type === 'image' ? (
          <FilePreviewImage key={index} src={toJpegDataUrl(chunk.base64 ?? '')} alt={file.sourceFilename} />
        ) : markdown ? (
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
