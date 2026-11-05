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
  children: React.ReactNode;
}

/** A code block in rendered markdown: a sticky header with the label and actions, then the code. */
const CodeBlock: React.FC<CodeBlockProps> = ({ label, actions, wrap = false, children }) => (
  <div className={cx('code-block-wrapper', wrap && 'code-block-wrapper--wrap')}>
    <div className="code-block-header">
      <span className="language-name t-overline">{label}</span>
      <div className="code-block-actions">{actions}</div>
    </div>
    {children}
  </div>
);

export default CodeBlock;
