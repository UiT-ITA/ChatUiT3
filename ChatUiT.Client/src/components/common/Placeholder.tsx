import React from 'react';
import { cx, splitBoxProps, splitLayoutProps, type BoxProps, type LayoutProps } from './layout';
import type { TextVariant } from './Text';
import './Placeholder.css';

interface PlaceholderProps extends LayoutProps, Omit<BoxProps, 'border' | 'borderSide' | 'radius'>, Omit<React.HTMLAttributes<HTMLElement>, 'color'> {
  // 'muted' draws the text in the muted colour, for an empty state
  tone?: 'default' | 'muted';
  // Highlights the frame on hover
  interactive?: boolean;
  // Centres the content in the frame
  centered?: boolean;
  // The typography role of text placed directly in the frame
  textVariant?: TextVariant;
  as?: React.ElementType;
}

/** A dashed frame for an empty state or an invitation to add something. */
const Placeholder: React.FC<PlaceholderProps> = ({ tone = 'default', interactive = false, centered = false, textVariant, as: Element = 'div', className, ...props }) => {
  const [box, hideClass, boxRest] = splitBoxProps(props);
  const [layout, rest] = splitLayoutProps(boxRest);
  return (
    <Element
      className={cx('placeholder', tone === 'muted' && 'placeholder--muted', interactive && 'placeholder--interactive', centered && 'placeholder--centered', textVariant && `t-${textVariant}`, hideClass, className)}
      style={{ ...box, ...layout }}
      {...rest}
    />
  );
};

export default Placeholder;
