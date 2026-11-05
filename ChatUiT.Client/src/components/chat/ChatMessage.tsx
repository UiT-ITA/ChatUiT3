import { useSignals } from '@preact/signals-react/runtime';
import { Suspense, createContext, lazy, useContext, useMemo, useState, memo, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { getActivitySignal, getStreamSignal } from '../../services/chatService';
import type { ChatMessageDto } from '../../types/chatModels';
import ReactMarkdown, { type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import Button from '../common/Button';
import CodeBlock from '../common/CodeBlock';
import IconButton from '../common/IconButton';
import { cx } from '../common/layout';
import RichText, { RichTextLink } from '../common/RichText';
import Stack from '../common/Stack';
import Text from '../common/Text';
import ZoomToggle from '../common/ZoomToggle';
import type { IconName } from '../common/Icon';
import FileThumbnail from './FileThumbnail';
import MessageActivity from './MessageActivity';
import useMediaQuery from '../../hooks/useMediaQuery';
import { MOBILE } from '../common/breakpoints';
import './Message.css';

interface ChatMessageProps {
  /** The chat this message belongs to — attachments resolve their content against it. */
  chatId: string;
  message: ChatMessageDto;
  /** Used only when the message has no assistant of its own. */
  fallbackAssistantName?: string;
}

// The diagram and code renderers load on first use
const MermaidDiagram = lazy(() => import('../common/MermaidDiagram'));
const LazyCodeHighlighter = lazy(() => import('../common/CodeHighlighter'));

function CodeHighlighter(props: { code: string; language: string; wrap?: boolean }) {
  return (
    <Suspense fallback={<pre><code>{props.code}</code></pre>}>
      <LazyCodeHighlighter {...props} />
    </Suspense>
  );
}

/** A button in a code block's header, with its label as the tooltip. Narrow screens show only the icon. */
function CodeAction({ label, ...props }: { label: string } & ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" size="small" compactOnMobile title={label} {...props}>
      {label}
    </Button>
  );
}

/** Whether the message around a code block is still streaming. */
const StreamingContext = createContext(false);

function copyCode(code: string) {
  navigator.clipboard.writeText(code)
    .catch(err => console.error('Failed to copy code:', err));
}

/** Mermaid code block: header with the fit/full size toggle and copy action, then the diagram. Clicking the diagram toggles its size. */
function MermaidBlock({ code }: { code: string }) {
  const { t } = useTranslation();
  const isStreaming = useContext(StreamingContext);
  const [fullSize, setFullSize] = useState(false);
  const toggleSize = () => setFullSize(value => !value);
  const sizeLabel = fullSize ? t('chat.mermaid.fit') : t('chat.mermaid.enlarge');
  const sizeTitle = fullSize ? t('chat.mermaid.fitWidth') : t('chat.mermaid.fullSize');
  const clickHint = fullSize ? t('chat.mermaid.clickToFit') : t('chat.mermaid.clickToEnlarge');

  return (
    <CodeBlock
      label={t('chat.mermaid.label')}
      actions={(
        <>
          {!isStreaming && (
            <CodeAction
              label={sizeLabel}
              title={sizeTitle}
              startIcon={fullSize ? 'zoomOut' : 'zoomIn'}
              aria-pressed={fullSize}
              onClick={toggleSize}
            />
          )}
          <CodeAction label={t('chat.actions.copySource')} startIcon="copy" onClick={() => copyCode(code)} />
        </>
      )}
    >
      {isStreaming ? (
        <CodeHighlighter code={code} language="text" />
      ) : (
        <ZoomToggle zoomed={fullSize} onToggle={toggleSize} hint={clickHint}>
          <Suspense fallback={<CodeHighlighter code={code} language="text" />}>
            <MermaidDiagram chart={code} fullSize={fullSize} showScrollbar />
          </Suspense>
        </ZoomToggle>
      )}
    </CodeBlock>
  );
}

/** Code block: header with the language, a line wrap toggle and the copy action, then the highlighted code. */
function CodeSnippet({ code, language }: { code: string; language: string }) {
  const { t } = useTranslation();
  // Narrow screens wrap long lines until the user turns wrapping off
  const narrow = useMediaQuery(MOBILE);
  const [wrapChoice, setWrapChoice] = useState<boolean | null>(null);
  const wrap = wrapChoice ?? narrow;

  return (
    <CodeBlock
      label={language}
      wrap={wrap}
      actions={(
        <>
          <CodeAction
            label={t('chat.actions.wrapLines')}
            startIcon="wrap"
            frame="line"
            active={wrap}
            aria-pressed={wrap}
            onClick={() => setWrapChoice(!wrap)}
          />
          <CodeAction label={t('chat.actions.copyCode')} startIcon="copy" onClick={() => copyCode(code)} />
        </>
      )}
    >
      <CodeHighlighter code={code} language={language} wrap={wrap} />
    </CodeBlock>
  );
}

type CodeProps = ComponentProps<'code'> & ExtraProps;
type AnchorProps = ComponentProps<'a'> & ExtraProps;

const markdownComponents = {
  code({ node, className, children, style, ...props }: CodeProps) {
    const language = /language-(\w+)/.exec(className || '')?.[1];
    const codeText = String(children).replace(/\n$/, '');
    if (language === 'mermaid') return <MermaidBlock code={codeText} />;
    if (language) return <CodeSnippet code={codeText} language={language} />;
    return <code className={className} style={style} {...props}>{children}</code>;
  },
  a({ node, children, ...props }: AnchorProps) {
    return <RichTextLink target="_blank" rel="noopener noreferrer" {...props}>{children}</RichTextLink>;
  },
};

function ChatMessage({ chatId, message, fallbackAssistantName }: ChatMessageProps) {
  useSignals();
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);

  const streamSignal = useMemo(() => {
    return message.status === "Generating" && !message.optimistic ? getStreamSignal(message.id, chatId) : null;
  }, [message.id, message.status, message.optimistic, chatId]);

  // The stored text followed by the streamed text
  const displayContent = message.status === "Generating"
    ? (message.content ?? "") + (streamSignal?.value || "")
    : message.content;

  const activitySignal = useMemo(() => {
    return message.status === "Generating" && message.role === 'Assistant' && !message.optimistic ? getActivitySignal(message.id, chatId, message.activity) : null;
  }, [message.id, message.status, message.role, message.optimistic, message.activity, chatId]);
  const liveActivity = activitySignal?.value ?? null;

  const isUser = message.role === 'User';
  const isAssistant = message.role === 'Assistant';
  const isSystem = message.role === 'System';
  const isStreaming = message.status === 'Generating';

  const handleCopyMessage = async () => {
    try {
      setIsCopied(true);
      
      // Loads the converter on demand and passes the HTML to the clipboard as a promise
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

  // Retry, edit and branch do nothing yet
  const notImplemented = () => {};

  // A message action: a small icon button with its name in a tooltip lined up with the message's edge
  const action = (icon: IconName, name: string, onClick: () => void) => (
    <IconButton key={name} icon={icon} label={t(`chat.actions.${name}`)} tooltipAlign={isUser ? 'end' : 'start'} size="small" iconSize="md" onClick={onClick} />
  );

  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const copyAction = action(isCopied ? 'check' : 'copy', 'copy', handleCopyMessage);

  // The user's message is a bubble at the right, the assistant's is plain text, a system message is a marked panel
  return (
    <div className={cx('message', `message--${isUser ? 'user' : isAssistant ? 'assistant' : 'system'}`, isStreaming && 'message--streaming')}>
      {isAssistant && (
        <MessageActivity activity={message.activity ?? null} live={liveActivity}>
          <Text variant="caption-strong" tone="default">{message.assistantName || fallbackAssistantName || t('chat.assistantLabel')}</Text>
          <Text variant="meta" tone="muted">{time}</Text>
          {message.optimistic && <Text variant="caption">{t('chat.creating')}</Text>}
        </MessageActivity>
      )}
      {message.files && message.files.length > 0 && (
        <Stack direction="row" wrap gap="sm" mb="sm">
          {message.files.map((file) => <FileThumbnail key={file.id} chatId={chatId} file={file} />)}
        </Stack>
      )}
      <RichText className="message__body">
        <StreamingContext.Provider value={isStreaming}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
            {displayContent}
          </ReactMarkdown>
        </StreamingContext.Provider>
      </RichText>
      <div className="message__toolbar">
        <div className="message__actions">
          {isUser
            ? [action('refresh', 'retry', notImplemented), action('edit', 'edit', notImplemented), copyAction]
            : [copyAction, ...(isSystem ? [] : [action('branch', 'branch', notImplemented), action('refresh', 'retry', notImplemented)])]}
        </div>
        {isUser && <Text variant="meta" tone="muted">{time}</Text>}
      </div>
    </div>
  );
}

// Re-renders only when a prop changes
export default memo(ChatMessage);
