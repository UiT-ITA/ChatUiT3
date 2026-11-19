import React from 'react';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import type { TextVariant } from './Text';
import './TextLink.css';

interface TextLinkProps extends LayoutProps {
  href?: string;
  // Downloads the target under this file name instead of opening it
  download?: string;
  variant?: TextVariant;
  children?: React.ReactNode;
}

/** A link in the accent colour, underlined on hover. */
const TextLink: React.FC<TextLinkProps> = ({ href, download, variant, children, ...props }) => {
  const [style] = splitLayoutProps(props);
  return <a href={href} download={download} className={cx('text-link', variant && `t-${variant}`)} style={style}>{children}</a>;
};

export default TextLink;
