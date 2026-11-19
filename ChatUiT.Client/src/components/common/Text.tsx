import React from 'react';
import { cx, space, splitBoxProps, splitLayoutProps, type BoxProps, type LayoutProps, type Space } from './layout';
import './Text.css';

export type TextVariant = 'hero' | 'page-title' | 'title' | 'lead' | 'chat' | 'body' | 'body-strong' | 'body-lg' | 'table' | 'table-strong'
  | 'ui' | 'ui-plain' | 'label' | 'caption' | 'caption-strong' | 'overline' | 'group-label' | 'hint' | 'meta' | 'status' | 'code' | 'chip' | 'tag';

// 'inherit' keeps the colour of the surrounding text
export type TextTone = 'inherit' | 'default' | 'secondary' | 'muted' | 'accent' | 'danger' | 'warning' | 'success';

export interface TextProps extends LayoutProps, BoxProps, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  // The typography role
  variant?: TextVariant;
  tone?: TextTone;
  // The element to render
  as?: React.ElementType;
  // Cuts the text to one line with an ellipsis
  truncate?: boolean;
  // 'nowrap' keeps the text on one line, 'pre' keeps its line breaks and spaces
  wrap?: 'normal' | 'nowrap' | 'pre';
  // Renders as a block instead of inline
  block?: boolean;
  // Tabular numerals
  numeric?: boolean;
  // Space kept above the element when it is scrolled into view
  scrollMarginTop?: Space;
  // Drops the uppercase and letter spacing it would inherit from an overline
  plainCase?: boolean;
  // Line height, from the --lh-* scale
  leading?: 'base';
  // Breaks long words and URLs that would overflow the line
  breakWord?: boolean;
  // Strikes the text through, for something that is no longer available
  strike?: boolean;
  htmlFor?: string;
  id?: string;
}

/** Text in one of the typography roles, in a text colour. */
const Text: React.FC<TextProps> = ({ variant, tone = 'inherit', as: Element = 'span', truncate = false, wrap = 'normal', block = false, numeric = false, scrollMarginTop, plainCase = false, leading, breakWord = false, strike = false, className, ...props }) => {
  const [box, boxRest] = splitBoxProps(props);
  const [layoutStyle, rest] = splitLayoutProps(boxRest);
  const layout = { ...box, ...(leading ? { lineHeight: `var(--lh-${leading})` } : {}), ...layoutStyle };
  const style = scrollMarginTop ? { ...layout, scrollMarginTop: space(scrollMarginTop) } : layout;
  return (
    <Element
      className={cx(
        variant && `t-${variant}`,
        tone !== 'inherit' && `text--tone-${tone}`,
        truncate && 'text--truncate',
        wrap !== 'normal' && `text--wrap-${wrap}`,
        block && 'text--block',
        numeric && 'text--numeric',
        plainCase && 'text--plain-case',
        breakWord && 'text--break-word',
        strike && 'text--strike',
        className,
      ) || undefined}
      style={style}
      {...rest}
    />
  );
};

export default Text;
