import React, { useLayoutEffect, useState, useRef, useEffect } from 'react';
import './ChatMessage.css';
import { MdRefresh, MdEdit, MdContentCopy, MdCallSplit, MdCheck } from 'react-icons/md';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { ChatRole, ChatStatus, Message } from '../../types/chatModels';
import { useTheme } from '../../contexts/ThemeContext';
import { markdownToHtml } from '../../utils/markdownUtils';
import { useChatData } from '../../contexts/ChatDataProvider';
import { useSignalR } from '../../contexts/SignalRContext';
import { useStreamingContent } from '../../hooks/useStreamingContent';
import { streamingService } from '../../services/streamingService';
import FilePreview from './FilePreview';

interface ChatMessageProps {
  message: Message;
  onStreamingChunk?: () => void;
}

const ChatMessage = ({ message, onStreamingChunk }: ChatMessageProps) => {
  const streamingContent = useStreamingContent(message.id);
  const { currentChatId } = useChatData();
  const { streamMessage, isConnected } = useSignalR();
  const requestedStreamingRef = useRef(new Set<string>());

  useEffect(() => {
    if (message.status === ChatStatus.Generating && 
        currentChatId && 
        isConnected &&
        !streamingService.hasStream(message.id)) {
      
      streamingService.startStream(message.id);
      streamMessage(message.id);
    }
  }, [message.status, message.id, currentChatId, streamMessage, isConnected]);

  useEffect(() => {
    if (message.status === ChatStatus.Success) {
      streamingService.cleanup(message.id);
    }
  }, [message.status, message.id]);

  const staticContent = message.content;
  const content = message.status === ChatStatus.Generating ? streamingContent : staticContent;
  const isUser = message.role === ChatRole.User;
  const isStreaming = message.status === ChatStatus.Generating;
  const isFileMessage = message.role === ChatRole.System;
  const { theme, markdownEnabled } = useTheme();
  const [isCopied, setIsCopied] = useState(false);
  const messageContentRef = useRef<HTMLDivElement>(null);

  const getSyntaxHighlighterStyle = () => {
    switch (theme) {
      case 'light':
        return oneLight;
      case 'dark':
        return atomDark;
      case 'alt-dark':
        return dracula;
      default:
        return atomDark;
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
      .catch(err => console.error('Failed to copy code:', err));
  };

  const handleCopyMessage = async () => {
    try {
      setIsCopied(true);
      
      if (markdownEnabled) {
        const htmlContent = markdownToHtml(content);
        const plainTextContent = content;
        
        const clipboardItem = new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([plainTextContent], { type: 'text/plain' })
        });
        
        await navigator.clipboard.write([clipboardItem]);
      } else {
        await navigator.clipboard.writeText(content);
      }
      
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy message:', err);
      setIsCopied(false);
    }
  };

  const handleRetry = () => {
    try {
    } catch (err) {
      console.error('Failed to retry message:', err);
    }
  };

  const handleEdit = () => {
    try {
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleBranch = () => {
    try {
    } catch (err) {
      console.error('Failed to branch message:', err);
    }
  };
  
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
              title="Copy code"
            >
              <MdContentCopy size="16px" /> Copy
            </button>
          </div>
          <SyntaxHighlighter
            style={getSyntaxHighlighterStyle()}
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

  useLayoutEffect(() => {
    if (isStreaming && onStreamingChunk) {
      onStreamingChunk();
    }
    // Only run when streaming content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamingContent]);

  return (
    <div className={`chat-message ${isUser ? 'user-message' : isFileMessage ? 'file-message' : 'assistant-message'} ${isStreaming ? 'streaming' : ''}`}>
      {message.files && message.files.length > 0 && (
        <div className="message-files">
          <FilePreview files={message.files} readonly={true} />
        </div>
      )}
      <div className="message-content" ref={messageContentRef}>
        {markdownEnabled ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={markdownComponents}
          >
            {content}
          </ReactMarkdown>
        ) : (
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
            {content}
          </pre>
        )}
        {isStreaming && <span className="streaming-indicator">▋</span>}
      </div>
      
      <div className="message-toolbar">
        {isUser ? (
          <>
            <span className="message-time">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div className="message-actions">
              <button className="message-action-button" title="Retry" onClick={handleRetry}>
                <MdRefresh size="20px" />
              </button>
              <button className="message-action-button" title="Edit" onClick={handleEdit}>
                <MdEdit size="20px" />
              </button>
              <button className="message-action-button" title="Copy" onClick={handleCopyMessage}>
                {isCopied ? <MdCheck size="20px" /> : <MdContentCopy size="20px" />}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="message-actions">
              <button className="message-action-button" title="Copy" onClick={handleCopyMessage}>
                {isCopied ? <MdCheck size="20px" /> : <MdContentCopy size="20px" />}
              </button>
              {!isFileMessage && (
                <>
                  <button className="message-action-button" title="Branch" onClick={handleBranch}>
                    <MdCallSplit size="20px" />
                  </button>
                  <button className="message-action-button" title="Retry" onClick={handleRetry}>
                    <MdRefresh size="20px" />
                  </button>
                </>
              )}
            </div>
            <span className="message-time">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(ChatMessage, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.status === nextProps.message.status
  );
});
