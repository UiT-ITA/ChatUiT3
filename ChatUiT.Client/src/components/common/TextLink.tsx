import React from 'react';
import { Link } from 'react-router-dom';
import { cx, splitLayoutProps, type LayoutProps } from './layout';
import type { TextVariant } from './Text';
import './TextLink.css';

interface TextLinkProps extends LayoutProps {
  // A route in the app
  to?: string;
  // A plain URL, used when no route is given
  href?: string;
  // Downloads the target under this file name instead of opening it
  download?: string;
  target?: string;
  rel?: string;
  variant?: TextVariant;
  children?: React.ReactNode;
}

/** A link in the accent colour, underlined on hover: to a route in the app, or to a URL. */
const TextLink: React.FC<TextLinkProps> = ({ to, href, download, target, rel, variant, children, ...props }) => {
  const [style] = splitLayoutProps(props);
  const className = cx('text-link', variant && `t-${variant}`);
  if (to !== undefined) {
    return <Link to={to} className={className} style={style} target={target} rel={rel}>{children}</Link>;
  }
  return <a href={href} download={download} target={target} rel={rel} className={className} style={style}>{children}</a>;
};

export default TextLink;
