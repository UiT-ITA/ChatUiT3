import React from 'react';
import { cx, space, splitBoxProps, splitLayoutProps, type BoxProps, type LayoutProps, type Space } from './layout';
import './Text.css';
import './Box.css';

export type TextVariant = 'hero' | 'page-title' | 'title' | 'lead' | 'chat' | 'body' | 'body-strong' | 'body-lg' | 'table' | 'table-strong'
  | 'ui' | 'ui-plain' | 'label' | 'caption' | 'caption-strong' | 'overline' | 'group-label' | 'hint' | 'meta' | 'status' | 'code' | 'chip' | 'tag';

// 'inherit' keeps the colour of the surrounding text
export type TextTone = 'inherit' | 'default' | 'secondary' | 'muted' | 'accent' | 'brand' | 'danger' | 'warning' | 'success';

export interface TextProps extends LayoutProps, BoxProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  // The typography role
  variant?: TextVariant;
  tone?: TextTone;
  // The element to render
  as?: React.ElementType;
  // Cuts the text to one line with an ellipsis
  truncate?: boolean;
  // Cuts the text to this many lines
  lines?: number;
  // 'nowrap' keeps the text on one line, 'pre' keeps its line breaks and spaces, 'anywhere' breaks long words where needed, 'break-all' breaks between any two letters
  wrap?: 'normal' | 'nowrap' | 'pre' | 'anywhere' | 'break-all';
  align?: 'start' | 'center' | 'end';
  // Renders as a block instead of inline
  block?: boolean;
  // Tabular numerals
  numeric?: boolean;
  // Space kept above the element when it is scrolled into view
  scrollMarginTop?: Space;
  // Drops the uppercase and letter spacing it would inherit from an overline
  plainCase?: boolean;
  // Line height, from the --lh-* scale
  leading?: 'tight' | 'base';
  // Breaks long words and URLs that would overflow the line
  breakWord?: boolean;
  // Strikes the text through, for something that is no longer available
  strike?: boolean;
  htmlFor?: string;
  id?: string;
}

/** Text in one of the typography roles, in a text colour. */
const Text: React.FC<TextProps> = ({ variant, tone = 'inherit', as: Element = 'span', truncate = false, lines, wrap = 'normal', align, block = false, numeric = false, scrollMarginTop, plainCase = false, leading, breakWord = false, strike = false, className, ...props }) => {
  const [box, hideClass, boxRest] = splitBoxProps(props);
  const [layoutStyle, rest] = splitLayoutProps(boxRest);
  const layout = { ...box, ...(leading ? { lineHeight: `var(--lh-${leading})` } : {}), ...layoutStyle };
  const withScroll = scrollMarginTop ? { ...layout, scrollMarginTop: space(scrollMarginTop) } : layout;
  const style = lines ? { ...withScroll, ['--text-lines' as string]: lines } : withScroll;
  return (
    <Element
      className={cx(
        variant && `t-${variant}`,
        tone !== 'inherit' && `text--tone-${tone}`,
        truncate && 'text--truncate',
        lines && 'text--clamp',
        wrap !== 'normal' && `text--wrap-${wrap}`,
        align && `text--align-${align}`,
        block && 'text--block',
        numeric && 'text--numeric',
        plainCase && 'text--plain-case',
        breakWord && 'text--break-word',
        strike && 'text--strike',
        hideClass,
        className,
      ) || undefined}
      style={style}
      {...rest}
    />
  );
};

export default Text;
