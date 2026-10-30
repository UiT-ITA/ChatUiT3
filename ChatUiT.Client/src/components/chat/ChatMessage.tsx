import './ChatMessage.css';
import './ChatMessageMarkdown.css';
import { useSignals } from '@preact/signals-react/runtime';
import { Suspense, lazy, useMemo, useState, useRef, useEffect, memo, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { getActivitySignal, getStreamSignal } from '../../services/chatService';
import type { ChatMessageDto } from '../../types/chatModels';
import ReactMarkdown, { type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import Button from '../common/Button';
import IconButton from '../common/IconButton';
import FileThumbnail from './FileThumbnail';
import MessageActivity from './MessageActivity';
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

// Heavy renderers load on first use, so they stay out of the startup bundle.
const MermaidDiagram = lazy(() => import('./MermaidDiagram'));
const LazyCodeHighlighter = lazy(() => import('./CodeHighlighter'));

function CodeHighlighter(props: { code: string; language: string; themeName: string }) {
  return (
    <Suspense fallback={<pre><code>{props.code}</code></pre>}>
      <LazyCodeHighlighter {...props} />
    </Suspense>
  );
}

type CodeProps = ComponentProps<'code'> & ExtraProps;
type AnchorProps = ComponentProps<'a'> & ExtraProps;

function ChatMessage({ chatId, message, fallbackAssistantName, onStreamingChunk }: ChatMessageProps) {
  useSignals();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [isCopied, setIsCopied] = useState(false);

  const codeblockTheme = getCodeblockTheme(settings.mode);

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
      
      // The converter is loaded on demand. Passing a promise keeps the
      // clipboard write inside the click's user activation.
      const htmlBlob = import('../../utils/markdownUtils').then(({ markdownToHtml }) =>
        new Blob([markdownToHtml(displayContent)], { type: 'text/html' }));
      const clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
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
                <Button
                  variant="ghost"
                  size="small"
                  startIcon="copy"
                  onClick={() => handleCopyCode(codeText)}
                  title={t('chat.actions.copyCode')}
                >
                  {t('chat.actions.copyCode')}
                </Button>
              </div>
              {isStreaming ? (
                <CodeHighlighter code={codeText} language="text" themeName={codeblockTheme} />
              ) : (
                <Suspense fallback={<CodeHighlighter code={codeText} language="text" themeName={codeblockTheme} />}>
                  <MermaidDiagram chart={codeText} className="mermaid-in-chat" />
                </Suspense>
              )}
            </div>
          );
        }
        
        // Handle regular code blocks
        return (
          <div className="code-block-wrapper">
            <div className="code-block-header">
              <span className="language-name t-overline">{language}</span>
              <Button
                variant="ghost"
                size="small"
                startIcon="copy"
                onClick={() => handleCopyCode(codeText)}
                title={t('chat.actions.copyCode')}
              >
                {t('chat.actions.copyCode')}
              </Button>
            </div>
            <CodeHighlighter code={codeText} language={language} themeName={codeblockTheme} />
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
              <IconButton icon="refresh" label={t('chat.actions.retry')} size="small" onClick={handleRetry} />
              <IconButton icon="edit" label={t('chat.actions.edit')} size="small" onClick={handleEdit} />
              <IconButton icon={isCopied ? "check" : "copy"} label={t('chat.actions.copy')} size="small" onClick={handleCopyMessage} />
            </div>
          </>
        ) : (
          <>
            <div className="message-actions">
              <IconButton icon={isCopied ? "check" : "copy"} label={t('chat.actions.copy')} size="small" onClick={handleCopyMessage} />
              {!isSystem && (
                <>
                  <IconButton icon="branch" label={t('chat.actions.branch')} size="small" onClick={handleBranch} />
                  <IconButton icon="refresh" label={t('chat.actions.retry')} size="small" onClick={handleRetry} />
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
