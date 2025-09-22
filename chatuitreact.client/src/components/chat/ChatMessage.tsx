import './ChatMessage.css';
import './ChatMessageMarkdown.css';
import { useSignals } from '@preact/signals-react/runtime';
import { useMemo, useState, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getStreamSignal } from '../../services/chatService';
import type { ChatMessageDto } from '../../types/chatModels';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
// import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
// import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { Icon } from '../common/Icon';
import FilePreview from './FilePreview';
import { segmentToolCalls } from '../../utils/toolCallParser';
import ToolCallBlock from './ToolCallBlock';
import { markdownToHtml } from '../../utils/markdownUtils';

interface ChatMessageProps {
  message: ChatMessageDto;
  onStreamingChunk?: () => void;
}

export default function ChatMessage({ message, onStreamingChunk }: ChatMessageProps) {
  useSignals();
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);

  const streamSignal = useMemo(() => {
    return message.status === "Generating" ? getStreamSignal(message.id) : null;
  }, [message.id, message.status]);

  const displayContent = message.status === "Generating"
    ? (streamSignal?.value || "")
    : message.content;

  const isUser = message.role === 'User';
  const isAssistant = message.role === 'Assistant';
  const isSystem = message.role === 'System';
  const isStreaming = message.status === 'Generating';

  const handleCopyMessage = async () => {
    try {
      setIsCopied(true);
      
      const htmlContent = markdownToHtml(displayContent);
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'text/plain': new Blob([displayContent], { type: 'text/plain' })
      });
      
      await navigator.clipboard.write([clipboardItem]);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
      setIsCopied(false);
    }
  };

  const segments = useMemo(() => segmentToolCalls(displayContent), [displayContent]);

  const handleRetry = () => {
    try {
      // Placeholder for retry functionality
    } catch (err) {
      console.error('Failed to retry message:', err);
    }
  };

  const handleEdit = () => {
    try {
      // Placeholder for edit functionality
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleBranch = () => {
    try {
      // Placeholder for branch functionality
    } catch (err) {
      console.error('Failed to branch message:', err);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
      .catch(err => console.error('Failed to copy code:', err));
  };

  useLayoutEffect(() => {
    if (isStreaming && onStreamingChunk) {
      onStreamingChunk();
    }
  }, [streamSignal?.value, isStreaming, onStreamingChunk]);

  const markdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const codeText = String(children).replace(/\n$/, '');
      return !inline && match ? (
        <div className="code-block-wrapper">
          <div className="code-block-header">
            <span className="language-name">{match[1]}</span>
            <button
              className="copy-code-button"
              onClick={() => handleCopyCode(codeText)}
              title={t('chat.actions.copyCode')}
            >
              <Icon name="copy" size={1} /> {t('chat.actions.copyCode')}
            </button>
          </div>
          <SyntaxHighlighter
            style={atomDark}
            language={match[1]}
            PreTag="div"
            {...props}
          >
            {codeText}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className={`chat-message ${isUser ? 'user-message' : isAssistant ? 'assistant-message' : 'system-message'} ${isStreaming ? 'streaming' : ''}`}>
      {message.files && message.files.length > 0 && (
        <div className="message-files">
          <div className="message-file-previews">
            {message.files.map((file) => (
              <FilePreview
                key={file.id}
                file={file}
                showRemoveButton={false}
              />
            ))}
          </div>
        </div>
      )}

      <div className="message-content">
        {segments.map((seg, i) => (
          seg.type === 'text' ? (
            <ReactMarkdown
              key={i}
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={markdownComponents}
            >
              {seg.text}
            </ReactMarkdown>
          ) : (
            <ToolCallBlock
              key={i}
              functionLine={seg.functionLine}
              functionName={seg.functionName}
              argsText={seg.argsText}
              resultText={seg.resultText}
              isComplete={seg.isComplete}
            />
          )
        ))}
      </div>

      <div className="message-toolbar">
        {isUser ? (
          <>
            <span className="message-time">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div className="message-actions">
              <button className="message-action-button" title={t('chat.actions.retry')} onClick={handleRetry}>
                <Icon name="refresh" size={1.25} />
              </button>
              <button className="message-action-button" title={t('chat.actions.edit')} onClick={handleEdit}>
                <Icon name="edit" size={1.25} />
              </button>
              <button className="message-action-button" title={t('chat.actions.copy')} onClick={handleCopyMessage}>
                <Icon name={isCopied ? "check" : "copy"} size={1.25} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="message-actions">
              <button className="message-action-button" title={t('chat.actions.copy')} onClick={handleCopyMessage}>
                <Icon name={isCopied ? "check" : "copy"} size={1.25} />
              </button>
              {!isSystem && (
                <>
                  <button className="message-action-button" title={t('chat.actions.branch')} onClick={handleBranch}>
                    <Icon name="branch" size={1.25} />
                  </button>
                  <button className="message-action-button" title={t('chat.actions.retry')} onClick={handleRetry}>
                    <Icon name="refresh" size={1.25} />
                  </button>
                </>
              )}
            </div>
            <span className="message-time">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
      </div>
    </div >
  );
}
