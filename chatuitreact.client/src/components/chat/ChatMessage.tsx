import './ChatMessage.css';
import { MdRefresh, MdEdit, MdContentCopy, MdCallSplit } from 'react-icons/md';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Or any other theme

import 'katex/dist/katex.min.css'; // KaTeX CSS

// Import Message type from the service to keep it consistent
import type { Message } from '../../services/chatService';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.sender === 'user';
  const isStreaming = message.isStreaming === true;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      // Optional: Show a temporary "Copied!" message or icon
      console.log('Code copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy code: ', err);
    });
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
    <div className={`chat-message ${isUser ? 'user-message' : 'assistant-message'} ${isStreaming ? 'streaming' : ''}`}>
      <div className="message-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={markdownComponents}
        >
          {message.text}
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
              <button className="message-action-button" title="Retry">
                <MdRefresh size="20px" />
              </button>
              <button className="message-action-button" title="Edit">
                <MdEdit size="20px" />
              </button>
              <button className="message-action-button" title="Copy">
                <MdContentCopy size="20px" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="message-actions">
              <button className="message-action-button" title="Copy">
                <MdContentCopy size="20px" />
              </button>
              <button className="message-action-button" title="Branch">
                <MdCallSplit size="20px" />
              </button>
              <button className="message-action-button" title="Retry">
                <MdRefresh size="20px" />
              </button>
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

export default ChatMessage;
