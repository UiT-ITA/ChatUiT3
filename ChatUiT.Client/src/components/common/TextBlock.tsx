import React from 'react';
import DOMPurify from 'dompurify';
import { cx } from './layout';
import './TextBlock.css';

/** Attributes that make the browser load a resource when the HTML renders. */
const LOADING_ATTRIBUTES = new Set(['src', 'srcset', 'poster', 'background']);
const CSS_RESOURCE = /url\s*\(|image-set|@import|\\/i;

/** A DOMPurify instance of its own, so its hooks do not apply to other users of DOMPurify. */
const purify = DOMPurify(window);

purify.addHook('afterSanitizeAttributes', node => {
  for (const { name, value } of Array.from(node.attributes ?? [])) {
    const isHref = name === 'href' || name === 'xlink:href';
    if (LOADING_ATTRIBUTES.has(name) || (isHref && node.tagName !== 'A') || CSS_RESOURCE.test(value)) {
      node.removeAttribute(name);
    }
  }

  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

type TextBlockProps = { surface?: 'code' | 'panel'; monospace?: boolean } & (
  | { html: string; children?: never }
  | { html?: undefined; children?: React.ReactNode }
);

/**
 * A framed block of preformatted text, in the table text size, that scrolls when it is long. The surface is the code fill, or the panel fill for prose such as a message body.
 * With html, the block shows that HTML, sanitized and without anything that loads a resource, instead of children.
 */
const TextBlock: React.FC<TextBlockProps> = ({ surface = 'code', monospace = false, html, children }) => {
  const className = cx('text-block', surface === 'panel' && 'text-block--panel', monospace && 'text-block--mono', html !== undefined && 'text-block--html', 't-table');
  if (html !== undefined) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: purify.sanitize(html, { FORBID_TAGS: ['style', 'form'] }) }} />;
  }

  return <div className={className}>{children}</div>;
};

export default TextBlock;
