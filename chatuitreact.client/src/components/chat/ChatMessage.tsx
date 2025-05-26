import React from 'react';
import './ChatMessage.css';
import { MdRefresh, MdEdit, MdContentCopy, MdCallSplit } from 'react-icons/md';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'katex/dist/katex.min.css';
import { Message, ChatRole, ChatStatus } from '../../types/chatModels';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === ChatRole.User;
  const isStreaming = message.status === ChatStatus.Generating;
  const isFileMessage = message.role === ChatRole.System;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
      .catch(err => console.error('Failed to copy code:', err));
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content)
      .catch(err => console.error('Failed to copy message:', err));
  };

  const handleRetry = () => {
    try {
      // TODO: Implement retry functionality
    } catch (err) {
      console.error('Failed to retry message:', err);
    }
  };

  const handleEdit = () => {
    try {
      // TODO: Implement edit functionality
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleBranch = () => {
    try {
      // TODO: Implement branch functionality
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
    <div className={`chat-message ${isUser ? 'user-message' : isFileMessage ? 'file-message' : 'assistant-message'} ${isStreaming ? 'streaming' : ''}`}>
      <div className="message-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={markdownComponents}
        >
          {message.content}
        </ReactMarkdown>
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
                <MdContentCopy size="20px" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="message-actions">
              <button className="message-action-button" title="Copy" onClick={handleCopyMessage}>
                <MdContentCopy size="20px" />
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

export default React.memo(ChatMessage);
