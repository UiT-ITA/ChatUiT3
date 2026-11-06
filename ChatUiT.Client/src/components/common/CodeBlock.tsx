import React from 'react';
import { cx } from './layout';
import './CodeBlock.css';

interface CodeBlockProps {
  // The language or kind of content, shown in the header
  label: React.ReactNode;
  // Buttons at the right end of the header
  actions?: React.ReactNode;
  // Long lines break inside the block instead of scrolling sideways
  wrap?: boolean;
  // The content is at most md tall and scrolls beyond that
  limited?: boolean;
  // Fills its container: no margin, and the content takes the remaining height
  filled?: boolean;
  children: React.ReactNode;
}

/** A code block in rendered markdown: a sticky header with the label and actions, then the content. */
const CodeBlock: React.FC<CodeBlockProps> = ({ label, actions, wrap = false, limited = false, filled = false, children }) => (
  <div className={cx('code-block-wrapper', wrap && 'code-block-wrapper--wrap', limited && 'code-block-wrapper--limited', filled && 'code-block-wrapper--filled')}>
    <div className="code-block-header">
      <span className="language-name t-overline">{label}</span>
      <div className="code-block-actions">{actions}</div>
    </div>
    <div className="code-block-body">{children}</div>
  </div>
);

export default CodeBlock;
