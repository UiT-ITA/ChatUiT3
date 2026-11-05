import React from 'react';
import { Icon } from './Icon';
import { cx } from './layout';
import './RichText.css';

interface RichTextProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'> {
  // 'message' is the full markdown look; 'notes' is short secondary markdown at caption size
  variant?: 'message' | 'notes';
  // A bordered surface around the content, for a document shown on its own
  framed?: boolean;
  // The look of a document page: a hairline above each section heading and numbered steps in accent circles
  document?: boolean;
}

/** A container for rendered markdown, which styles the headings, lists, tables, code and links inside it. */
const RichText: React.FC<RichTextProps> = ({ variant = 'message', framed = false, document = false, className, ...props }) => (
  <div className={cx('rich-text', `rich-text--${variant}`, framed && 'rich-text--framed', document && 'rich-text--document', className)} {...props} />
);

/** A link in rendered markdown that leaves the app, with an arrow icon after its text. */
export const RichTextLink: React.FC<React.ComponentProps<'a'>> = ({ children, ...props }) => (
  <a {...props}>
    {children}
    <Icon name="externalLink" className="rich-text__link-icon" />
  </a>
);

export default RichText;
