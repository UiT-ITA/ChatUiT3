import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { ProcessedFile } from '../../types/importModels';
import { toJpegDataUrl } from '../../import/processingShared';
import './FilePreviewModal.css';
import './ChatMessageMarkdown.css';

interface ProcessedFilePreviewContentProps {
  file: ProcessedFile;
  compact?: boolean;
}

const ProcessedFilePreviewContent = ({ file, compact = false }: ProcessedFilePreviewContentProps) => {
  return (
    <div className={`file-preview-content${compact ? ' file-preview-content--compact' : ''}`}>
      {file.chunks.map((chunk) => {
        if (chunk.type === 'image') {
          return (
            <img
              key={chunk.id}
              src={toJpegDataUrl(chunk.base64)}
              alt={file.sourceFilename}
              className="file-preview-image"
            />
          );
        }

        if (chunk.format === 'markdown') {
          return (
            <div key={chunk.id} className="message-content file-preview-markdown">
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
          <pre key={chunk.id} className="file-preview-text">
            {chunk.text}
          </pre>
        );
      })}
    </div>
  );
};

export default ProcessedFilePreviewContent;