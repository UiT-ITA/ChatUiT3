import './ChatMessage.css';
import './ChatMessageMarkdown.css';
import { useSignals } from '@preact/signals-react/runtime';
import { useMemo, useState, useRef, useEffect, memo, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { getActivitySignal, getStreamSignal } from '../../services/chatService';
import type { ChatMessageDto } from '../../types/chatModels';
import ReactMarkdown, { type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark, dracula, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { Icon } from '../common/Icon';
import FileThumbnail from './FileThumbnail';
import MessageActivity from './MessageActivity';
import { markdownToHtml } from '../../utils/markdownUtils';
import MermaidDiagram from './MermaidDiagram';
import { useSettings } from '../../hooks/useSettings';
import { getCodeblockTheme } from '../../utils/themeUtils';

interface ChatMessageProps {
  /** The chat this message belongs to — attachments resolve their content against it. */
  chatId: string;
  message: ChatMessageDto;
  /** Used only when the message has no assistant of its own. */
  fallbackAssistantName?: string;
  onStreamingChunk?: () => void;
}

const styleMap = {
  oneLight: oneLight,
  atomDark: atomDark,
  dracula: dracula
};

type CodeProps = ComponentProps<'code'> & ExtraProps;
type AnchorProps = ComponentProps<'a'> & ExtraProps;

function ChatMessage({ chatId, message, fallbackAssistantName, onStreamingChunk }: ChatMessageProps) {
  useSignals();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [isCopied, setIsCopied] = useState(false);

  const currentCodeblockStyle = useMemo(() => {
    const themeName = getCodeblockTheme(settings.mode);
    return styleMap[themeName as keyof typeof styleMap] || atomDark;
  }, [settings.mode]);

  const streamSignal = useMemo(() => {
    return message.status === "Generating" && !message.optimistic ? getStreamSignal(message.id, chatId) : null;
  }, [message.id, message.status, message.optimistic, chatId]);

  const displayContent = message.status === "Generating"
    ? (streamSignal?.value || "")
    : message.content;

  const activitySignal = useMemo(() => {
    return message.status === "Generating" && message.role === 'Assistant' && !message.optimistic ? getActivitySignal(message.id, chatId) : null;
  }, [message.id, message.status, message.role, message.optimistic, chatId]);
  const liveActivity = activitySignal?.value ?? null;

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

  const onStreamingChunkRef = useRef(onStreamingChunk);
  useEffect(() => {
    onStreamingChunkRef.current = onStreamingChunk;
  }, [onStreamingChunk]);

  useEffect(() => {
    if (isStreaming) {
      onStreamingChunkRef.current?.();
    }
  }, [streamSignal?.value, isStreaming]);

  // console.log('Rendering ChatMessage:', message.id, 'isStreaming:', isStreaming);

  const markdownComponents = {
    code({ node, className, children, style, ...props }: CodeProps) {
      const match = /language-(\w+)/.exec(className || '');
      const codeText = String(children).replace(/\n$/, '');

      if (match) {
        const language = match[1];
        
        if (language === 'mermaid') {
          return (
            <div className="code-block-wrapper">
              <div className="code-block-header">
                <span className="language-name t-overline">Mermaid Diagram</span>
                <button
                  className="copy-code-button t-caption-strong"
                  onClick={() => handleCopyCode(codeText)}
                  title={t('chat.actions.copyCode')}
                >
                  <Icon name="copy" size={1} /> {t('chat.actions.copyCode')}
                </button>
              </div>
              {isStreaming ? (
                <SyntaxHighlighter style={currentCodeblockStyle} language="text">
                  {codeText}
                </SyntaxHighlighter>
              ) : (
                <MermaidDiagram chart={codeText} className="mermaid-in-chat" />
              )}
            </div>
          );
        }
        
        // Handle regular code blocks
        return (
          <div className="code-block-wrapper">
            <div className="code-block-header">
              <span className="language-name t-overline">{language}</span>
              <button
                className="copy-code-button t-caption-strong"
                onClick={() => handleCopyCode(codeText)}
                title={t('chat.actions.copyCode')}
              >
                <Icon name="copy" size={1} /> {t('chat.actions.copyCode')}
              </button>
            </div>
            <SyntaxHighlighter
              style={currentCodeblockStyle}
              language={language}
            >
              {codeText}
            </SyntaxHighlighter>
          </div>
        );
      }
      
      return (
        <code className={className} style={style} {...props}>
          {children}
        </code>
      );
    },
    a({ node, href, children, ...props }: AnchorProps) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className={`chat-message ${isUser ? 'user-message' : isAssistant ? 'assistant-message' : 'system-message'} ${isStreaming ? 'streaming' : ''}`}>
      {isAssistant && (
        <MessageActivity activity={message.activity ?? null} live={liveActivity} chatId={chatId} messageId={message.id}>
          <span className="message-meta-name t-overline">{message.assistantName || fallbackAssistantName || t('chat.assistantLabel')}</span>
          <span className="message-time t-meta">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.optimistic && <span className="t-caption">{t('chat.creating')}</span>}
        </MessageActivity>
      )}

      {message.files && message.files.length > 0 && (
        <div className="message-files">
          <div className="message-file-previews">
            {message.files.map((file) => (
              <FileThumbnail
                key={file.id}
                chatId={chatId}
                file={file}
                showRemoveButton={false}
              />
            ))}
          </div>
        </div>
      )}

      <div className="message-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={markdownComponents}
        >
          {displayContent}
        </ReactMarkdown>
      </div>

      <div className="message-toolbar">
        {isUser ? (
          <>
            <span className="message-time t-meta">
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
          </>
        )}
      </div>
    </div >
  );
}

// Memoize to prevent rerenders when message object reference hasn't changed
export default memo(ChatMessage);
