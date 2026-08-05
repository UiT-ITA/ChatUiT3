import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { ChatFile } from '../../types/fileModels';
import { toJpegDataUrl } from '../../import/processingShared';
import './FilePreviewModal.css';
import './ChatMessageMarkdown.css';

interface ChatFilePreviewContentProps {
  file: ChatFile;
  compact?: boolean;
}

const ChatFilePreviewContent = ({ file, compact = false }: ChatFilePreviewContentProps) => {
  return (
    <div className={`file-preview-content${compact ? ' file-preview-content--compact' : ''}`}>
      {file.chunks.map((chunk, index) => {
        if (chunk.type === 'image') {
          return (
            <img
              key={index}
              src={toJpegDataUrl(chunk.base64)}
              alt={file.sourceFilename}
              className="file-preview-image"
            />
          );
        }

        if (chunk.format === 'markdown') {
          return (
            <div key={index} className="message-content file-preview-markdown">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {chunk.text}
              </ReactMarkdown>
            </div>
          );
        }

        return (
          <pre key={index} className="file-preview-text t-code">
            {chunk.text}
          </pre>
        );
      })}
    </div>
  );
};

export default ChatFilePreviewContent;
